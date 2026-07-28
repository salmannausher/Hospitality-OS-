import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { HotelSummary, UpdateHotelRequest } from '@hospitality/types';
import { authorizeHotelAccess } from '../authorize-hotel-access';
import { PrismaService } from '../../common/prisma/prisma.service';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * `GET /v1/admin/hotels[/:id]`, `PATCH /v1/admin/hotels/:id`, `POST
 * /v1/admin/hotels` (API §3.1). Unlike every other admin service, this one's
 * resource IS the tenant boundary — `:id` is a path param, not the usual
 * `?hotelId=` query param `HotelScopeGuard` expects — so authorization here
 * calls the same shared `authorizeHotelAccess` helper directly rather than
 * going through that guard (findings-log.md #22/#24).
 *
 * `PATCH` only ever touches `name`/`slug` — `Hotel` has no `timezone` column
 * despite API §3.1 mentioning one (findings-log.md #23); adding it is a
 * schema migration, out of scope for a "surfaces only" sprint. Slug
 * uniqueness relies on the DB's own `@unique` constraint (caught as P2002
 * below), not a pre-check query — under this hotel's own RLS-scoped
 * transaction, every OTHER hotel's row is already invisible, so a
 * `findFirst` "is this slug taken by someone else" query could never see a
 * real conflict to begin with.
 */
@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every hotel the caller can act on — direct `HotelMembership` rows PLUS
   * org-reached hotels (findings-log.md #22). No role restriction: nothing
   * documents one for a plain list read. */
  async list(userId: string): Promise<HotelSummary[]> {
    const hotels = await this.prisma.resolveMemberHotels(userId);
    return hotels.map((h) => ({ id: h.id, name: h.name, slug: h.slug }));
  }

  async get(userId: string, hotelId: string): Promise<HotelSummary> {
    await authorizeHotelAccess(this.prisma, userId, hotelId, 'GET');
    return this.prisma.withTenant(hotelId, async (tx) => {
      const hotel = await tx.hotel.findFirst({ where: { id: hotelId } });
      if (!hotel) throw this.notFound(hotelId);
      return { id: hotel.id, name: hotel.name, slug: hotel.slug };
    });
  }

  async update(
    userId: string,
    hotelId: string,
    body: UpdateHotelRequest,
  ): Promise<HotelSummary> {
    // authorizeHotelAccess itself rejects a VIEWER on this PATCH (method is
    // mutating) — findings-log.md #24.
    await authorizeHotelAccess(this.prisma, userId, hotelId, 'PATCH');

    const data: { name?: string; slug?: string } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message: '"name" must be a non-empty string.',
            requestId: randomUUID(),
          },
        });
      }
      data.name = body.name;
    }
    if (body.slug !== undefined) {
      if (typeof body.slug !== 'string' || !SLUG_PATTERN.test(body.slug)) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message:
              '"slug" must be lowercase letters, numbers, and hyphens only.',
            requestId: randomUUID(),
          },
        });
      }
      data.slug = body.slug;
    }

    return this.prisma.withTenant(hotelId, async (tx) => {
      const existing = await tx.hotel.findFirst({ where: { id: hotelId } });
      if (!existing) throw this.notFound(hotelId);

      try {
        const updated = await tx.hotel.update({
          where: { id: hotelId },
          data,
        });
        return { id: updated.id, name: updated.name, slug: updated.slug };
      } catch (err) {
        throw this.translateSlugConflict(err, data.slug);
      }
    });
  }

  /** `POST /v1/admin/hotels` — `AGENCY_ADMIN` only, literal reading of API
   * §3.1's "AGENCY_ADMIN only" (not `SUPER_ADMIN` — findings-log.md #24).
   * Creates under the caller's own organization, resolved from their
   * `OrganizationMembership` — carries no RLS predicate (migration
   * `1_rls_policies`'s explicit exception), so this check is a plain query.
   * The insert itself goes through `PrismaService.createHotel` (findings-log.md
   * #22) since `Hotel`'s own RLS policy blocks app_role from inserting a row
   * that doesn't exist yet under any session's `app.hotel_id`. */
  async create(
    userId: string,
    body: { name?: unknown; slug?: unknown },
  ): Promise<HotelSummary> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { userId, role: 'AGENCY_ADMIN' },
    });
    if (!membership) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'Only an Agency Admin can create a new hotel.',
          requestId: randomUUID(),
        },
      });
    }

    if (typeof body.name !== 'string' || body.name.trim() === '') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message: '"name" must be a non-empty string.',
          requestId: randomUUID(),
        },
      });
    }
    if (typeof body.slug !== 'string' || !SLUG_PATTERN.test(body.slug)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message:
            '"slug" must be lowercase letters, numbers, and hyphens only.',
          requestId: randomUUID(),
        },
      });
    }

    try {
      const hotel = await this.prisma.createHotel(
        membership.organizationId,
        body.name,
        body.slug,
      );
      return { id: hotel.id, name: hotel.name, slug: hotel.slug };
    } catch (err) {
      throw this.translateSlugConflict(err, body.slug);
    }
  }

  /** `update()` goes through Prisma's query builder, whose unique-constraint
   * violations surface as `P2002`. `create()` goes through the raw-SQL
   * `admin_create_hotel` function (findings-log.md #22) instead, whose
   * violations come back as a generic failed-raw-query error carrying the
   * underlying Postgres code (`23505` — unique_violation) in the message,
   * not translated to `P2002`. Both are handled here so the two call sites
   * share one translation rather than duplicating this check. */
  private translateSlugConflict(
    err: unknown,
    slug: string | undefined,
  ): unknown {
    const code = (err as { code?: string }).code;
    const message = err instanceof Error ? err.message : '';
    if (code === 'P2002' || message.includes('23505')) {
      return new ConflictException({
        error: {
          code: 'SLUG_TAKEN',
          message: `"${slug}" is already in use by another hotel.`,
          requestId: randomUUID(),
        },
      });
    }
    return err;
  }

  private notFound(hotelId: string): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'HOTEL_NOT_FOUND',
        message: `No hotel with id "${hotelId}".`,
        requestId: randomUUID(),
      },
    });
  }
}
