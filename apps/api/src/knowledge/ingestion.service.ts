import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmbeddingsService } from '../ai/embeddings.service';
import { GatewayService, type ExtractionResult } from '../ai/gateway.service';
import { ChunkerService, type Chunk } from './chunker.service';
import { ParserService } from './parser.service';
import { UrlFetcherService } from './url-fetcher.service';
import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
} from './storage/document-storage';
import { INGESTION_QUEUE, type IngestionQueue } from './queue/ingestion-queue';

type Stage =
  | 'PARSING'
  | 'EXTRACTING'
  | 'CHUNKING'
  | 'TAGGING'
  | 'EMBEDDING'
  | 'VALIDATING';

type SourceType = 'PDF' | 'DOCX' | 'TEXT' | 'URL';

export type DocumentStatusValue =
  'PARSING' | 'NEEDS_REVIEW' | 'FAILED' | 'INDEXED';

interface StageRecord {
  stage: Stage;
  status: 'SUCCEEDED' | 'FAILED';
  error: string | null;
  startedAt: Date;
  completedAt: Date;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  sourceType: string;
  sourceUrl: string | null;
  status: string;
  validationIssues: string[];
  uploadedAt: Date;
  lastSyncedAt: Date | null;
}

export interface StageStatusEntry {
  stage: string;
  status: string;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ChunkPreviewItem {
  id: string;
  content: string;
  domainTags: string[];
  priority: string;
  tokenCount: number | null;
}

/**
 * Ingestion worker — the pipeline in IA §5 / Architecture §5:
 * parse → entity extraction → chunk → domain tagging → embed → write → validate,
 * with a per-stage IngestionJob row for diagnosability (DB §5) and a final
 * status of INDEXED / NEEDS_REVIEW / FAILED (IA §9). All DB writes go through
 * PrismaService.withTenant, so RLS scopes them to the hotel.
 *
 * Extraction is the one card-gated stage (the model call). On its failure the
 * document is marked NEEDS_REVIEW (AI Engine §8) but chunks are still embedded
 * and written, so re-running ingestion once the card is present flips it to
 * INDEXED without re-parsing from scratch.
 *
 * Each IngestionJob row is written incrementally — created RUNNING when a
 * stage starts, updated to SUCCEEDED/FAILED when it finishes — rather than
 * batched at the end, so `GET .../documents/:id/status` (API §3.2) can show
 * the guest-facing "Reading… Chunking… Embedding…" progression (UX §9) while
 * a document is actively processing, not just after the fact.
 */
@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ParserService,
    private readonly chunker: ChunkerService,
    private readonly gateway: GatewayService,
    private readonly embeddings: EmbeddingsService,
    private readonly urlFetcher: UrlFetcherService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    @Inject(INGESTION_QUEUE) private readonly queue: IngestionQueue,
  ) {}

  onModuleInit(): void {
    this.queue.process(async (payload) => {
      await this.processDocument(payload);
    });
  }

  /**
   * Accept a raw file: store bytes, create the Document (PARSING), enqueue async
   * processing. Returns immediately (Architecture §5). This is what the authed
   * admin upload endpoint calls.
   */
  async ingestFile(
    hotelId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<{ documentId: string }> {
    const documentId = await this.createDocument(hotelId, { filename, buffer });
    await this.queue.enqueue({ documentId, hotelId });
    return { documentId };
  }

  /**
   * Fetch a public URL, extract its readable text, and ingest it exactly like
   * an uploaded file (IA §4 "Web pages (URL sync)"). One-shot fetch-and-extract
   * only — the fuller "scheduled re-crawl, diffed" behavior IA §4 also
   * describes needs recurring-job infra (Architecture §8's BullMQ swap isn't
   * wired to a real queue yet) and is deliberately deferred, not built here.
   */
  async ingestUrl(
    hotelId: string,
    sourceUrl: string,
  ): Promise<{ documentId: string }> {
    const text = await this.urlFetcher.fetchText(sourceUrl);
    const documentId = await this.createDocument(hotelId, {
      filename: this.filenameFromUrl(sourceUrl),
      buffer: Buffer.from(text, 'utf8'),
      sourceType: 'URL',
      sourceUrl,
    });
    await this.queue.enqueue({ documentId, hotelId });
    return { documentId };
  }

  /**
   * Store, create, and process a document inline (bypassing the queue), waiting
   * for completion. For CLI ingestion and tests — the HTTP path uses ingestFile.
   */
  async ingestNow(
    hotelId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<{ documentId: string; status: string }> {
    const documentId = await this.createDocument(hotelId, { filename, buffer });
    // processDocument already persists AND returns the final status — reading
    // it back via a second transaction was pure overhead (and, under pooler
    // load, an extra place to flakily time out on a value already known).
    const status = await this.processDocument({ documentId, hotelId });
    return { documentId, status };
  }

  private async createDocument(
    hotelId: string,
    input: {
      filename: string;
      buffer: Buffer;
      sourceType?: SourceType;
      sourceUrl?: string;
    },
  ): Promise<string> {
    const storageUrl = await this.storage.store(
      hotelId,
      input.filename,
      input.buffer,
    );
    const sourceType =
      input.sourceType ?? this.detectSourceType(input.filename);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const doc = await tx.document.create({
        data: {
          hotelId,
          filename: input.filename,
          sourceType,
          storageUrl,
          sourceUrl: input.sourceUrl ?? null,
          lastSyncedAt: input.sourceUrl ? new Date() : null,
          status: 'PARSING',
        },
      });
      return doc.id;
    });
  }

  /** Bulk re-enqueue every non-deleted document for a hotel (API §3.2 reindex). */
  async reindex(hotelId: string): Promise<number> {
    const ids = await this.prisma.withTenant(hotelId, async (tx) => {
      const docs = await tx.document.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return docs.map((d) => d.id);
    });
    for (const documentId of ids)
      await this.queue.enqueue({ documentId, hotelId });
    return ids.length;
  }

  // --- Admin read surface (API §3.2) ----------------------------------------

  /** List documents for a hotel, optionally filtered by status — powers the
   * upload screen's status badges (UX §9). Cursor-paginated per API §1. */
  async listDocuments(
    hotelId: string,
    opts: {
      status?: DocumentStatusValue;
      cursor?: string;
      limit?: number;
    } = {},
  ): Promise<{ items: DocumentSummary[]; nextCursor: string | null }> {
    const limit = Math.min(opts.limit ?? 50, 100);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const docs = await tx.document.findMany({
        where: {
          deletedAt: null,
          ...(opts.status ? { status: opts.status } : {}),
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      });
      const hasMore = docs.length > limit;
      const page = hasMore ? docs.slice(0, limit) : docs;
      return {
        items: page.map((d) => ({
          id: d.id,
          filename: d.filename,
          sourceType: d.sourceType,
          sourceUrl: d.sourceUrl,
          status: d.status,
          validationIssues: d.validationIssues,
          uploadedAt: d.uploadedAt,
          lastSyncedAt: d.lastSyncedAt,
        })),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      };
    });
  }

  /** Per-stage pipeline status from IngestionJob rows (API §3.2) — the UI's
   * "Reading… Chunking… Embedding…" labels, polled at 2s while processing. */
  async getStageStatus(
    hotelId: string,
    documentId: string,
  ): Promise<{ documentStatus: string; stages: StageStatusEntry[] }> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const doc = await tx.document.findFirstOrThrow({
        where: { id: documentId },
      });
      const jobs = await tx.ingestionJob.findMany({
        where: { documentId },
        orderBy: { startedAt: 'asc' },
      });
      return {
        documentStatus: doc.status,
        stages: jobs.map((j) => ({
          stage: j.stage,
          status: j.status,
          error: j.error,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
        })),
      };
    });
  }

  /** Chunk preview (API §3.2) — content + tags + priority, never embeddings.
   * Cursor-paginated per API §1. */
  async getChunks(
    hotelId: string,
    documentId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: ChunkPreviewItem[]; nextCursor: string | null }> {
    const limit = Math.min(opts.limit ?? 50, 100);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.chunk.findMany({
        where: { documentId },
        select: {
          id: true,
          content: true,
          domainTags: true,
          priority: true,
          tokenCount: true,
        },
        orderBy: { id: 'asc' },
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return {
        items: page,
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      };
    });
  }

  // ---------------------------------------------------------------------------

  async processDocument(payload: {
    documentId: string;
    hotelId: string;
  }): Promise<'INDEXED' | 'NEEDS_REVIEW' | 'FAILED'> {
    const { documentId, hotelId } = payload;
    const stages: StageRecord[] = [];
    let finalStatus: 'INDEXED' | 'NEEDS_REVIEW' | 'FAILED' = 'INDEXED';
    const issues: string[] = [];

    // Fresh run — clear any previous attempt's per-stage rows before writing
    // new ones incrementally as each stage starts/completes.
    await this.prisma.withTenant(hotelId, (tx) =>
      tx.ingestionJob.deleteMany({ where: { documentId } }),
    );

    try {
      const doc = await this.prisma.withTenant(hotelId, (tx) =>
        tx.document.findFirstOrThrow({ where: { id: documentId } }),
      );

      // 1. PARSING — fatal on failure. URL-synced documents already have
      // plain extracted text stored (UrlFetcherService ran at ingestUrl
      // time) — the ParserService's extension-based dispatch doesn't apply.
      const parsed = await this.runStage(
        hotelId,
        documentId,
        stages,
        'PARSING',
        async () => {
          const buffer = await this.storage.read(doc.storageUrl);
          if (doc.sourceType === 'URL') {
            return {
              text: buffer.toString('utf8'),
              sourceType: 'URL' as const,
            };
          }
          return this.parser.parse(doc.filename, buffer);
        },
      );

      // 2. EXTRACTING — card-gated; failure degrades to NEEDS_REVIEW, not fatal.
      let extraction: ExtractionResult = { entities: [], domainTags: [] };
      try {
        extraction = await this.runStage(
          hotelId,
          documentId,
          stages,
          'EXTRACTING',
          () => this.gateway.extractEntities(parsed.text),
        );
      } catch (err) {
        finalStatus = 'NEEDS_REVIEW';
        issues.push(
          `Entity extraction failed: ${String((err as Error)?.message ?? err)}`,
        );
      }

      // 3. CHUNKING
      const chunks = await this.runStage(
        hotelId,
        documentId,
        stages,
        'CHUNKING',
        () => Promise.resolve(this.chunker.chunk(parsed.text)),
      );

      // 4. TAGGING — chunks inherit the document's domain tags (IA §2).
      const domainTags = extraction.domainTags;
      await this.runStage(hotelId, documentId, stages, 'TAGGING', () =>
        Promise.resolve(domainTags),
      );

      // 5. EMBEDDING — fatal on failure (no retrievable content without vectors).
      const vectors = await this.runStage(
        hotelId,
        documentId,
        stages,
        'EMBEDDING',
        () =>
          this.embeddings.embed(
            chunks.map((c) => c.content),
            'document',
          ),
      );

      // Write chunks + extracted entities (one tenant-scoped transaction).
      await this.prisma.withTenant(hotelId, async (tx) => {
        await tx.$executeRaw`DELETE FROM "Chunk" WHERE "documentId" = ${documentId}`;
        await this.writeChunks(tx, {
          hotelId,
          documentId,
          sourceType: parsed.sourceType,
          domainTags,
          chunks,
          vectors,
        });
        await this.writeEntities(tx, hotelId, extraction);
      });

      // 6. VALIDATING (IA §9) — empty chunks, missing required entity fields.
      issues.push(
        ...(await this.runStage(hotelId, documentId, stages, 'VALIDATING', () =>
          Promise.resolve(this.validate(chunks, extraction)),
        )),
      );
      if (issues.length > 0) finalStatus = 'NEEDS_REVIEW';
    } catch (err) {
      // Parse/embedding/other fatal failure.
      finalStatus = 'FAILED';
      this.logger.error(
        `Ingestion failed for document ${documentId}: ${String(
          (err as Error)?.message ?? err,
        )}`,
      );
    }

    await this.finalizeDocument(hotelId, documentId, finalStatus, issues);
    this.logger.log(`Document ${documentId} → ${finalStatus}`);
    return finalStatus;
  }

  // ---------------------------------------------------------------------------

  private async runStage<T>(
    hotelId: string,
    documentId: string,
    stages: StageRecord[],
    stage: Stage,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date();
    const job = await this.prisma.withTenant(hotelId, (tx) =>
      tx.ingestionJob.create({
        data: { hotelId, documentId, stage, status: 'RUNNING', startedAt },
      }),
    );
    try {
      const result = await fn();
      const completedAt = new Date();
      stages.push({
        stage,
        status: 'SUCCEEDED',
        error: null,
        startedAt,
        completedAt,
      });
      await this.prisma.withTenant(hotelId, (tx) =>
        tx.ingestionJob.update({
          where: { id: job.id },
          data: { status: 'SUCCEEDED', completedAt },
        }),
      );
      return result;
    } catch (err) {
      const completedAt = new Date();
      const error = String((err as Error)?.message ?? err);
      stages.push({ stage, status: 'FAILED', error, startedAt, completedAt });
      await this.prisma.withTenant(hotelId, (tx) =>
        tx.ingestionJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', error, completedAt },
        }),
      );
      throw err;
    }
  }

  private async writeChunks(
    tx: Prisma.TransactionClient,
    input: {
      hotelId: string;
      documentId: string;
      sourceType: SourceType;
      domainTags: string[];
      chunks: Chunk[];
      vectors: number[][];
    },
  ): Promise<void> {
    for (let i = 0; i < input.chunks.length; i++) {
      const c = input.chunks[i];
      const literal = `[${input.vectors[i].join(',')}]`;
      await tx.$executeRaw`
        INSERT INTO "Chunk"
          ("id","hotelId","documentId","domainTags","sourceType","language","priority","lastVerifiedAt","content","tokenCount","embedding")
        VALUES
          (${randomUUID()}, ${input.hotelId}, ${input.documentId}, ${input.domainTags}::text[],
           ${input.sourceType}::"DocumentSourceType", 'en', ${c.priority}::"Priority", now(),
           ${c.content}, ${c.tokenCount}, ${literal}::vector)
      `;
    }
  }

  private validate(chunks: Chunk[], extraction: ExtractionResult): string[] {
    const issues: string[] = [];
    if (chunks.length === 0) issues.push('No chunks produced.');
    if (chunks.some((c) => c.content.trim().length < 10))
      issues.push('One or more empty/near-empty chunks.');
    // IA §9 example: a RoomType with no capacity is a missing required field.
    for (const e of extraction.entities) {
      if (e.type === 'RoomType' && e.fields.capacity == null)
        issues.push(`RoomType "${e.name ?? 'unnamed'}" is missing capacity.`);
      if (!e.name) issues.push(`A ${e.type} entity is missing its name.`);
    }
    return issues;
  }

  private async finalizeDocument(
    hotelId: string,
    documentId: string,
    status: 'INDEXED' | 'NEEDS_REVIEW' | 'FAILED',
    validationIssues: string[],
  ): Promise<void> {
    await this.prisma.withTenant(hotelId, (tx) =>
      tx.document.update({
        where: { id: documentId },
        data: { status, validationIssues },
      }),
    );
  }

  private detectSourceType(filename: string): SourceType {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (ext === 'pdf') return 'PDF';
    if (ext === 'docx') return 'DOCX';
    return 'TEXT';
  }

  private filenameFromUrl(sourceUrl: string): string {
    const { hostname, pathname } = new URL(sourceUrl);
    const slug = `${hostname}${pathname}`
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${slug || 'synced-page'}.txt`;
  }

  // --- Entity mapping: loose extracted fields → typed rows (best-effort). ---

  private async writeEntities(
    tx: Prisma.TransactionClient,
    hotelId: string,
    extraction: ExtractionResult,
  ): Promise<void> {
    for (const e of extraction.entities) {
      const f = e.fields;
      const name = e.name ?? str(f.name);
      if (!name && e.type !== 'PropertyProfile') continue;
      switch (e.type) {
        case 'RoomType':
          await tx.roomType.create({
            data: {
              hotelId,
              name: name ?? 'Unnamed room',
              view: str(f.view),
              capacity: int(f.capacity) ?? 0,
              bedConfig: str(f.bedConfig),
              accessible: bool(f.accessible) ?? false,
              baseRateLow: dec(f.baseRateLow),
              baseRateHigh: dec(f.baseRateHigh),
            },
          });
          break;
        case 'Restaurant':
          await tx.restaurant.create({
            data: {
              hotelId,
              name: name!,
              cuisine: str(f.cuisine),
              hours: str(f.hours),
              dressCode: str(f.dressCode),
              dietaryTags: strArr(f.dietaryTags),
              reservationPolicy: str(f.reservationPolicy),
            },
          });
          break;
        case 'SpaTreatment':
          await tx.spaTreatment.create({
            data: {
              hotelId,
              name: name!,
              durationMins: int(f.durationMins),
              price: dec(f.price),
              facility: str(f.facility),
            },
          });
          break;
        case 'Amenity':
          await tx.amenity.create({
            data: {
              hotelId,
              name: name!,
              hours: str(f.hours),
              location: str(f.location),
              accessRule: str(f.accessRule),
            },
          });
          break;
        case 'Policy':
          await tx.policy.create({
            data: {
              hotelId,
              topic: str(f.topic) ?? name!,
              ruleText: str(f.ruleText) ?? '',
              exceptions: str(f.exceptions),
            },
          });
          break;
        case 'LocalRecommendation':
          await tx.localRecommendation.create({
            data: {
              hotelId,
              name: name!,
              category: str(f.category),
              distanceNote: str(f.distanceNote),
              curationNote: str(f.curationNote),
            },
          });
          break;
        case 'EventSpace':
          await tx.eventSpace.create({
            data: {
              hotelId,
              name: name!,
              capacity: int(f.capacity),
              layoutOptions: strArr(f.layoutOptions),
              avEquipment: strArr(f.avEquipment),
              cateringMinimum: dec(f.cateringMinimum),
            },
          });
          break;
        case 'Experience':
          await tx.experience.create({
            data: {
              hotelId,
              name: name!,
              category: str(f.category),
              durationMins: int(f.durationMins),
              price: dec(f.price),
              bookingLeadHrs: int(f.bookingLeadHrs),
              ageRestriction: str(f.ageRestriction),
            },
          });
          break;
        case 'Package':
          await tx.package.create({
            data: {
              hotelId,
              name: name!,
              includedItems: strArr(f.includedItems),
              priceLow: dec(f.priceLow),
              priceHigh: dec(f.priceHigh),
            },
          });
          break;
        case 'PropertyProfile':
          // Singleton per hotel — upsert rather than duplicate.
          await tx.propertyProfile.upsert({
            where: { hotelId },
            create: {
              hotelId,
              brandStory: str(f.brandStory),
              history: str(f.history),
              location: str(f.location),
            },
            update: {},
          });
          break;
      }
    }
  }
}

// --- Coercion helpers for loosely-typed extracted fields ---
type Field = string | number | boolean | null | undefined;
function str(v: Field): string | null {
  if (v == null) return null;
  return typeof v === 'string' ? v : String(v);
}
function int(v: Field): number | null {
  if (v == null) return null;
  const n =
    typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function dec(v: Field): number | null {
  if (v == null) return null;
  const n =
    typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function bool(v: Field): boolean | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  return /^(true|yes|1)$/i.test(String(v));
}
function strArr(v: Field): string[] {
  if (v == null) return [];
  if (typeof v === 'string')
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}
