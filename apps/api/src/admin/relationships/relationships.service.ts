import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityType as PrismaEntityType, Prisma } from '@prisma/client';
import type { RecommendationCard } from '@hospitality/types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ENTITY_CONFIGS } from '../../common/entities/entity-config';
import { CardAssemblyService } from '../../ai/card-assembly.service';

const VALID_PRIORITIES = ['HIGH', 'NORMAL', 'LOW'] as const;
type PriorityValue = (typeof VALID_PRIORITIES)[number];

interface CreateRelationshipBody {
  fromEntityType?: unknown;
  fromEntityId?: unknown;
  toEntityType?: unknown;
  toEntityId?: unknown;
  relationshipType?: unknown;
  contextTag?: unknown;
  priority?: unknown;
}

/**
 * `EntityRelationship` CRUD (API §3.3, IA §12) — the curated edges the
 * Recommendation Engine queries directly by `contextTag` (IA §12: "instead of
 * relying on vector similarity to accidentally surface a coherent bundle").
 * No soft delete here — unlike the nine entity tables, `EntityRelationship`
 * has no `deletedAt` column (DB §1's soft-delete rule doesn't list it; a
 * curated edge is trivial to recreate, unlike losing real entity data), so
 * `remove` is a real delete.
 */
@Injectable()
export class RelationshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cardAssembly: CardAssemblyService,
  ) {}

  async list(
    hotelId: string,
    opts: { contextTag?: string; cursor?: string; limit?: number },
  ): Promise<{
    items: Array<Record<string, unknown>>;
    nextCursor: string | null;
  }> {
    const limit = Math.min(opts.limit ?? 50, 100);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.entityRelationship.findMany({
        where: {
          hotelId,
          ...(opts.contextTag ? { contextTag: opts.contextTag } : {}),
        },
        orderBy: [{ contextTag: 'asc' }, { priority: 'asc' }],
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      };
    });
  }

  async get(hotelId: string, id: string): Promise<Record<string, unknown>> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const row = await tx.entityRelationship.findFirst({ where: { id } });
      if (!row) {
        throw new NotFoundException({
          error: {
            code: 'RELATIONSHIP_NOT_FOUND',
            message: `No relationship with id "${id}".`,
            requestId: randomUUID(),
          },
        });
      }
      return row;
    });
  }

  async create(
    hotelId: string,
    body: CreateRelationshipBody,
  ): Promise<Record<string, unknown>> {
    const fromEntityType = this.requireEntityType(
      body.fromEntityType,
      'fromEntityType',
    );
    const toEntityType = this.requireEntityType(
      body.toEntityType,
      'toEntityType',
    );
    const fromEntityId = this.requireString(body.fromEntityId, 'fromEntityId');
    const toEntityId = this.requireString(body.toEntityId, 'toEntityId');
    const relationshipType = this.requireString(
      body.relationshipType,
      'relationshipType',
    );
    const contextTag = this.requireString(body.contextTag, 'contextTag');
    const priority = this.optionalPriority(body.priority);

    return this.prisma.withTenant(hotelId, async (tx) => {
      await this.assertEntityExists(
        tx,
        fromEntityType,
        fromEntityId,
        'fromEntityId',
      );
      await this.assertEntityExists(tx, toEntityType, toEntityId, 'toEntityId');
      return tx.entityRelationship.create({
        data: {
          hotelId,
          fromEntityType,
          fromEntityId,
          toEntityType,
          toEntityId,
          relationshipType,
          contextTag,
          priority: priority ?? 'NORMAL',
        },
      });
    });
  }

  async remove(hotelId: string, id: string): Promise<void> {
    await this.prisma.withTenant(hotelId, async (tx) => {
      const existing = await tx.entityRelationship.findFirst({ where: { id } });
      if (!existing) {
        throw new NotFoundException({
          error: {
            code: 'RELATIONSHIP_NOT_FOUND',
            message: `No relationship with id "${id}".`,
            requestId: randomUUID(),
          },
        });
      }
      await tx.entityRelationship.delete({ where: { id } });
    });
  }

  /** API §3.3: `{ contextTag }` → the exact `card` event payload the guest
   * would receive — calls the same `CardAssemblyService` the live chat
   * pipeline uses (Sprint 3 ticket 3), so the bundle builder's preview can
   * never drift from what a guest actually sees. */
  async preview(
    hotelId: string,
    contextTag: string,
  ): Promise<{ type: 'card'; cards: RecommendationCard[] }> {
    const cards = await this.cardAssembly.buildCards(hotelId, contextTag);
    return { type: 'card', cards };
  }

  private async assertEntityExists(
    tx: Prisma.TransactionClient,
    entityType: string,
    entityId: string,
    field: string,
  ): Promise<void> {
    const config = Object.values(ENTITY_CONFIGS).find(
      (c) => c.entityType === entityType,
    );
    if (!config) return; // Unreachable — requireEntityType already validated this.
    const delegate = (
      tx as unknown as Record<
        string,
        { findFirst: (args: unknown) => Promise<unknown> }
      >
    )[config.model];
    const row = await delegate.findFirst({
      where: { id: entityId, deletedAt: null },
    });
    if (!row) {
      throw new BadRequestException({
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: `"${field}": no ${entityType} entity with id "${entityId}".`,
          requestId: randomUUID(),
        },
      });
    }
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_FIELD',
          message: `"${field}" is required and must be a non-empty string.`,
          requestId: randomUUID(),
        },
      });
    }
    return value;
  }

  private requireEntityType(value: unknown, field: string): PrismaEntityType {
    const type = this.requireString(value, field);
    const known = Object.values(ENTITY_CONFIGS).some(
      (c) => c.entityType === type,
    );
    if (!known) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_ENTITY_TYPE',
          message: `"${field}": unknown entity type "${type}". Valid types: ${Object.values(
            ENTITY_CONFIGS,
          )
            .map((c) => c.entityType)
            .join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    // Runtime-validated above against ENTITY_CONFIGS's own EntityType values.
    return type as PrismaEntityType;
  }

  private optionalPriority(value: unknown): PriorityValue | undefined {
    if (value == null) return undefined;
    if (
      typeof value !== 'string' ||
      !VALID_PRIORITIES.includes(value as PriorityValue)
    ) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message: `"priority" must be one of: ${VALID_PRIORITIES.join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return value as PriorityValue;
  }
}
