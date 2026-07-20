import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmbeddingsService } from '../ai/embeddings.service';
import { GatewayService, type ExtractionResult } from '../ai/gateway.service';
import { ChunkerService, type Chunk } from './chunker.service';
import { ParserService } from './parser.service';
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

interface StageRecord {
  stage: Stage;
  status: 'SUCCEEDED' | 'FAILED';
  error: string | null;
  startedAt: Date;
  completedAt: Date;
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
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    @Inject(INGESTION_QUEUE) private readonly queue: IngestionQueue,
  ) {}

  onModuleInit(): void {
    this.queue.process((payload) => this.processDocument(payload));
  }

  /**
   * Accept a raw file: store bytes, create the Document (PARSING), enqueue async
   * processing. Returns immediately (Architecture §5). This is what the authed
   * admin upload endpoint will call once Supabase Auth is wired.
   */
  async ingestFile(
    hotelId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<{ documentId: string }> {
    const documentId = await this.createDocument(hotelId, filename, buffer);
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
    const documentId = await this.createDocument(hotelId, filename, buffer);
    await this.processDocument({ documentId, hotelId });
    const doc = await this.prisma.withTenant(hotelId, (tx) =>
      tx.document.findFirstOrThrow({
        where: { id: documentId },
        select: { status: true },
      }),
    );
    return { documentId, status: doc.status };
  }

  private async createDocument(
    hotelId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const storageUrl = await this.storage.store(hotelId, filename, buffer);
    const sourceType = this.detectSourceType(filename);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const doc = await tx.document.create({
        data: { hotelId, filename, sourceType, storageUrl, status: 'PARSING' },
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

  // ---------------------------------------------------------------------------

  async processDocument(payload: {
    documentId: string;
    hotelId: string;
  }): Promise<void> {
    const { documentId, hotelId } = payload;
    const stages: StageRecord[] = [];
    let finalStatus: 'INDEXED' | 'NEEDS_REVIEW' | 'FAILED' = 'INDEXED';

    try {
      const doc = await this.prisma.withTenant(hotelId, (tx) =>
        tx.document.findFirstOrThrow({ where: { id: documentId } }),
      );

      // 1. PARSING — fatal on failure.
      const parsed = await this.runStage(stages, 'PARSING', async () => {
        const buffer = await this.storage.read(doc.storageUrl);
        return this.parser.parse(doc.filename, buffer);
      });

      // 2. EXTRACTING — card-gated; failure degrades to NEEDS_REVIEW, not fatal.
      let extraction: ExtractionResult = { entities: [], domainTags: [] };
      try {
        extraction = await this.runStage(stages, 'EXTRACTING', () =>
          this.gateway.extractEntities(parsed.text),
        );
      } catch {
        finalStatus = 'NEEDS_REVIEW';
      }

      // 3. CHUNKING
      const chunks = await this.runStage(stages, 'CHUNKING', () =>
        Promise.resolve(this.chunker.chunk(parsed.text)),
      );

      // 4. TAGGING — chunks inherit the document's domain tags (IA §2).
      const domainTags = extraction.domainTags;
      await this.runStage(stages, 'TAGGING', () => Promise.resolve(domainTags));

      // 5. EMBEDDING — fatal on failure (no retrievable content without vectors).
      const vectors = await this.runStage(stages, 'EMBEDDING', () =>
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
      const issues = await this.runStage(stages, 'VALIDATING', () =>
        Promise.resolve(this.validate(chunks, extraction)),
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

    await this.persistJobsAndStatus(hotelId, documentId, stages, finalStatus);
    this.logger.log(`Document ${documentId} → ${finalStatus}`);
  }

  // ---------------------------------------------------------------------------

  private async runStage<T>(
    stages: StageRecord[],
    stage: Stage,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date();
    try {
      const result = await fn();
      stages.push({
        stage,
        status: 'SUCCEEDED',
        error: null,
        startedAt,
        completedAt: new Date(),
      });
      return result;
    } catch (err) {
      stages.push({
        stage,
        status: 'FAILED',
        error: String((err as Error)?.message ?? err),
        startedAt,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  private async writeChunks(
    tx: Prisma.TransactionClient,
    input: {
      hotelId: string;
      documentId: string;
      sourceType: 'PDF' | 'DOCX' | 'TEXT';
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

  private async persistJobsAndStatus(
    hotelId: string,
    documentId: string,
    stages: StageRecord[],
    status: 'INDEXED' | 'NEEDS_REVIEW' | 'FAILED',
  ): Promise<void> {
    await this.prisma.withTenant(hotelId, async (tx) => {
      await tx.ingestionJob.deleteMany({ where: { documentId } });
      if (stages.length > 0) {
        await tx.ingestionJob.createMany({
          data: stages.map((s) => ({
            hotelId,
            documentId,
            stage: s.stage,
            status: s.status,
            error: s.error,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
          })),
        });
      }
      await tx.document.update({ where: { id: documentId }, data: { status } });
    });
  }

  private detectSourceType(filename: string): 'PDF' | 'DOCX' | 'TEXT' | 'URL' {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    if (ext === 'pdf') return 'PDF';
    if (ext === 'docx') return 'DOCX';
    return 'TEXT';
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
