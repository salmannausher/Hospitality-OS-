import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ChunkPriority } from './scoring';

/**
 * Retrieval — AI Engine §1 step 4 / IA §7. Domain-filtered vector similarity
 * over the hotel's chunks, using the pgvector cosine operator against the HNSW
 * index (migration 1_rls_policies). Plain SQL, not a model call.
 *
 * ALWAYS called with the transaction client from PrismaService.withTenant, so
 * Postgres RLS scopes every row to the resolved hotel — there is deliberately
 * no hotelId in the WHERE clause here; the database enforces it (docs/07 §9).
 * Prisma has no native pgvector type, so this is $queryRaw.
 *
 * Only chunks from INDEXED, non-soft-deleted documents are eligible — IA §9
 * ("no answer is ever generated from a Needs Review or Failed chunk") and the
 * soft-delete rule (API §3.2: deleting a document drops its chunks from
 * retrieval immediately). This is enforced by the JOIN below.
 */
@Injectable()
export class RetrievalService {
  /**
   * Return the top-`limit` chunks by cosine similarity to `queryEmbedding`,
   * filtered to `domains` when the classifier produced any (else searched
   * across all domains). `similarity` is `1 - cosine_distance`, in [0,1].
   */
  async retrieve(
    tx: Prisma.TransactionClient,
    params: {
      queryEmbedding: number[];
      domains: string[];
      limit: number;
    },
  ): Promise<RetrievedChunk[]> {
    // pgvector accepts its text representation, cast with ::vector.
    const vectorLiteral = `[${params.queryEmbedding.join(',')}]`;

    const rows =
      params.domains.length > 0
        ? await tx.$queryRaw<RetrievedChunkRow[]>`
            SELECT
              c."id",
              c."content",
              c."priority",
              c."domainTags",
              c."lastVerifiedAt",
              1 - (c."embedding" <=> ${vectorLiteral}::vector) AS "similarity"
            FROM "Chunk" c
            JOIN "Document" d ON d."id" = c."documentId"
            WHERE d."status" = 'INDEXED'::"DocumentStatus"
              AND d."deletedAt" IS NULL
              AND c."domainTags" && ${params.domains}::text[]
            ORDER BY c."embedding" <=> ${vectorLiteral}::vector
            LIMIT ${params.limit}
          `
        : await tx.$queryRaw<RetrievedChunkRow[]>`
            SELECT
              c."id",
              c."content",
              c."priority",
              c."domainTags",
              c."lastVerifiedAt",
              1 - (c."embedding" <=> ${vectorLiteral}::vector) AS "similarity"
            FROM "Chunk" c
            JOIN "Document" d ON d."id" = c."documentId"
            WHERE d."status" = 'INDEXED'::"DocumentStatus"
              AND d."deletedAt" IS NULL
            ORDER BY c."embedding" <=> ${vectorLiteral}::vector
            LIMIT ${params.limit}
          `;

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      priority: r.priority,
      domainTags: r.domainTags,
      lastVerifiedAt: r.lastVerifiedAt,
      similarity: Number(r.similarity),
    }));
  }
}

interface RetrievedChunkRow {
  id: string;
  content: string;
  priority: ChunkPriority;
  domainTags: string[];
  lastVerifiedAt: Date;
  similarity: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  priority: ChunkPriority;
  domainTags: string[];
  lastVerifiedAt: Date;
  similarity: number;
}
