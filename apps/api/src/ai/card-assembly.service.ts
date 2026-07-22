import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RecommendationCard } from '@hospitality/types';
import { PrismaService } from '../common/prisma/prisma.service';
import { ENTITY_CONFIGS } from '../common/entities/entity-config';
import { buildHook, buildTitle } from '../common/entities/entity-display';

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };

/** A soft cap, not a content rule — IA §12's examples show 2-3 entities per
 * bundle; this just guards against an admin curating an unreasonably large
 * one from ever flooding the guest-facing card carousel. */
const MAX_CARDS = 6;

interface EntityRef {
  entityType: string;
  entityId: string;
  priority: string;
}

/**
 * The single card-assembly implementation behind API §2.1's `card` SSE event
 * — shared by the admin Relationship Bundle builder's live preview
 * (`POST /v1/admin/relationships/preview`) and the live guest chat pipeline
 * (Sprint 3 ticket 3 wires this into `ChatService`), per API §3.3: "one
 * implementation, no drift."
 *
 * Deterministic, no model call (IA §12: the Recommendation Engine queries
 * `EntityRelationship` directly by `contextTag` instead of a similarity
 * match; AI Engine §1's call inventory has no card-assembly step).
 */
@Injectable()
export class CardAssemblyService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCards(
    hotelId: string,
    contextTag: string,
  ): Promise<RecommendationCard[]> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const edges = await tx.entityRelationship.findMany({
        where: { hotelId, contextTag },
      });

      const refs = new Map<string, EntityRef>();
      for (const edge of edges) {
        addRef(refs, edge.fromEntityType, edge.fromEntityId, edge.priority);
        addRef(refs, edge.toEntityType, edge.toEntityId, edge.priority);
      }

      const resolved = await Promise.all(
        [...refs.values()].map(async (ref) => ({
          ref,
          card: await this.resolveCard(tx, ref),
        })),
      );

      return resolved
        .filter(
          (r): r is { ref: EntityRef; card: RecommendationCard } =>
            r.card !== null,
        )
        .sort(
          (a, b) =>
            (PRIORITY_RANK[a.ref.priority] ?? 1) -
            (PRIORITY_RANK[b.ref.priority] ?? 1),
        )
        .slice(0, MAX_CARDS)
        .map((r) => r.card);
    });
  }

  private async resolveCard(
    tx: Prisma.TransactionClient,
    ref: EntityRef,
  ): Promise<RecommendationCard | null> {
    const config = Object.values(ENTITY_CONFIGS).find(
      (c) => c.entityType === ref.entityType,
    );
    if (!config) return null; // e.g. PROPERTY_PROFILE — not a card-eligible type (see entity-config.ts).
    const delegate = (
      tx as unknown as Record<
        string,
        {
          findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
        }
      >
    )[config.model];
    const row = await delegate.findFirst({
      where: { id: ref.entityId, deletedAt: null },
    });
    if (!row) return null; // Soft-deleted or never-existed entity — silently drop from the bundle.
    return {
      entityType: ref.entityType as RecommendationCard['entityType'],
      entityId: ref.entityId,
      title: buildTitle(config, row),
      hook: buildHook(config, row),
    };
  }
}

function addRef(
  refs: Map<string, EntityRef>,
  entityType: string,
  entityId: string,
  priority: string,
): void {
  const key = `${entityType}:${entityId}`;
  const existing = refs.get(key);
  if (
    !existing ||
    (PRIORITY_RANK[priority] ?? 1) < (PRIORITY_RANK[existing.priority] ?? 1)
  ) {
    refs.set(key, { entityType, entityId, priority });
  }
}
