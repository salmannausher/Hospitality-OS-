import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ENTITY_CONFIGS,
  type EntityConfig,
  type FieldSpec,
} from '../../common/entities/entity-config';

interface EntityDelegate {
  findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
  findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
}

/**
 * Generic CRUD + search over the nine structured-entity tables (API §3.3, DB
 * §6) — one uniform surface rather than nine near-identical services, since
 * every table shares the same shape of operation (tenant-scoped, soft-delete,
 * cursor-paginated list). Per-entity differences (which fields exist, which
 * are required, which field is the display name) live in `entity-config.ts`.
 */
@Injectable()
export class EntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    hotelId: string,
    typeParam: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<{
    items: Array<Record<string, unknown>>;
    nextCursor: string | null;
  }> {
    const config = this.resolveConfig(typeParam);
    const limit = Math.min(opts.limit ?? 50, 100);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const delegate = this.delegate(tx, config);
      const rows = await delegate.findMany({
        where: { deletedAt: null },
        orderBy: { [config.searchField]: 'asc' },
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return {
        items,
        nextCursor: hasMore ? (items[items.length - 1].id as string) : null,
      };
    });
  }

  async get(
    hotelId: string,
    typeParam: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    const config = this.resolveConfig(typeParam);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const row = await this.findActive(tx, config, id);
      return row;
    });
  }

  async create(
    hotelId: string,
    typeParam: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = this.resolveConfig(typeParam);
    const data = this.buildData(config, body, { partial: false });
    return this.prisma.withTenant(hotelId, async (tx) => {
      const delegate = this.delegate(tx, config);
      return delegate.create({ data: { hotelId, ...data } });
    });
  }

  async update(
    hotelId: string,
    typeParam: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const config = this.resolveConfig(typeParam);
    const data = this.buildData(config, body, { partial: true });
    return this.prisma.withTenant(hotelId, async (tx) => {
      await this.findActive(tx, config, id);
      const delegate = this.delegate(tx, config);
      return delegate.update({ where: { id }, data });
    });
  }

  async remove(hotelId: string, typeParam: string, id: string): Promise<void> {
    const config = this.resolveConfig(typeParam);
    await this.prisma.withTenant(hotelId, async (tx) => {
      await this.findActive(tx, config, id);
      const delegate = this.delegate(tx, config);
      await delegate.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  /** Typeahead for the bundle builder (API §3.3, UX §10) — `q` matched against
   * each type's display-name field, `types` narrowing which of the nine to
   * search (defaults to all nine). */
  async search(
    hotelId: string,
    opts: { q: string; types?: string[] },
  ): Promise<Array<{ id: string; entityType: string; name: string }>> {
    const typeParams = opts.types?.length
      ? opts.types.map((t) => this.paramForEntityType(t))
      : Object.keys(ENTITY_CONFIGS);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const perType = await Promise.all(
        typeParams.map(async (typeParam) => {
          const config = ENTITY_CONFIGS[typeParam];
          const delegate = this.delegate(tx, config);
          const rows = await delegate.findMany({
            where: {
              deletedAt: null,
              [config.searchField]: { contains: opts.q, mode: 'insensitive' },
            },
            take: 10,
          });
          return rows.map((row) => ({
            id: row.id as string,
            entityType: config.entityType,
            name: row[config.searchField] as string,
          }));
        }),
      );
      return perType.flat();
    });
  }

  private async findActive(
    tx: Prisma.TransactionClient,
    config: EntityConfig,
    id: string,
  ): Promise<Record<string, unknown>> {
    const delegate = this.delegate(tx, config);
    const row = await delegate.findFirst({ where: { id, deletedAt: null } });
    if (!row) {
      throw new NotFoundException({
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: `No entity of type "${config.entityType}" with id "${id}".`,
          requestId: randomUUID(),
        },
      });
    }
    return row;
  }

  private resolveConfig(typeParam: string): EntityConfig {
    const config = ENTITY_CONFIGS[typeParam];
    if (!config) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_ENTITY_TYPE',
          message: `Unknown entity type "${typeParam}". Valid types: ${Object.keys(
            ENTITY_CONFIGS,
          ).join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return config;
  }

  private paramForEntityType(entityType: string): string {
    const found = Object.entries(ENTITY_CONFIGS).find(
      ([, config]) => config.entityType === entityType,
    );
    if (!found) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_ENTITY_TYPE',
          message: `Unknown entity type "${entityType}". Valid types: ${Object.values(
            ENTITY_CONFIGS,
          )
            .map((c) => c.entityType)
            .join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return found[0];
  }

  private delegate(
    tx: Prisma.TransactionClient,
    config: EntityConfig,
  ): EntityDelegate {
    return (tx as unknown as Record<string, EntityDelegate>)[config.model];
  }

  private buildData(
    config: EntityConfig,
    body: Record<string, unknown>,
    opts: { partial: boolean },
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const field of config.fields) {
      const present = field.name in body;
      if (!present) {
        if (!opts.partial && field.required) {
          throw new BadRequestException({
            error: {
              code: 'MISSING_FIELD',
              message: `"${field.name}" is required.`,
              requestId: randomUUID(),
            },
          });
        }
        continue;
      }
      data[field.name] = this.coerce(field, body[field.name]);
    }
    return data;
  }

  private coerce(field: FieldSpec, value: unknown): unknown {
    if (value === null) return null;
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') throw this.typeError(field, 'a string');
        return value;
      case 'int':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          throw this.typeError(field, 'an integer');
        }
        return value;
      case 'decimal':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw this.typeError(field, 'a number');
        }
        return value;
      case 'boolean':
        if (typeof value !== 'boolean')
          throw this.typeError(field, 'a boolean');
        return value;
      case 'stringArray':
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
          throw this.typeError(field, 'an array of strings');
        }
        return value;
      case 'date':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          throw this.typeError(field, 'an ISO date string');
        }
        return new Date(value);
      default:
        return value;
    }
  }

  private typeError(field: FieldSpec, expected: string): BadRequestException {
    return new BadRequestException({
      error: {
        code: 'INVALID_FIELD',
        message: `"${field.name}" must be ${expected}.`,
        requestId: randomUUID(),
      },
    });
  }
}
