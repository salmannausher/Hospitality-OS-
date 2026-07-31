import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Runtime database access, connecting as the restricted `app_role`
 * (NOSUPERUSER NOBYPASSRLS — migration 2_app_role) through the Supavisor
 * transaction pooler on DATABASE_URL. This is deliberately NOT the migration
 * connection (DIRECT_URL / postgres owner, which bypasses RLS) — see CLAUDE.md
 * and docs/07-database-design.md §9.
 *
 * Because the pooler runs in TRANSACTION mode, a bare `SET app.hotel_id` would
 * not survive to the next pooled statement. Tenant context must therefore be
 * set with `set_config(..., is_local => true)` INSIDE a transaction, and every
 * tenant-scoped query must run in that same transaction. `withTenant()` is the
 * only correct way to touch tenant data at runtime — see its doc comment.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set — the runtime (app_role, transaction pooler) connection is required.',
      );
    }
    // Driver adapter (Prisma 7): the runtime connects through node-postgres.
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to Postgres as the runtime role (app_role).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run `fn` with the RLS tenant context bound to `hotelId`. Every query issued
   * on the transaction client passed to `fn` is filtered by Postgres row-level
   * security to that hotel — application code physically cannot read another
   * tenant's rows, even with a forgotten WHERE clause (docs/07 §9, Arch §6).
   *
   * `set_config('app.hotel_id', $1, true)` — the `true` scopes the setting to
   * this transaction only, which is mandatory under the transaction pooler.
   */
  async withTenant<T>(
    hotelId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeoutMs?: number; maxWaitMs?: number },
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.hotel_id', ${hotelId}, true)`;
        // Guarantee the pgvector type/operators resolve for this transaction even
        // on a reused pooler connection (see migration 4_app_role_pgvector_access).
        await tx.$executeRawUnsafe(
          'SET LOCAL search_path TO "$user", public, extensions',
        );
        return fn(tx);
      },
      // Default (Prisma's own — `timeout`: 5s to run, `maxWait`: 2s to even
      // acquire a connection) stays the norm for every ordinary caller. Only
      // opt a specific call into a longer window when it genuinely needs one:
      // either more real work than the default assumes (findings-log.md #32:
      // IngestionService's find-then-update-or-create entity writes), or —
      // `maxWait` specifically — a call on a path that's shown it can hit real
      // Supabase Supavisor connection-acquisition latency under live use
      // (findings-log.md #33: the live chat pipeline, not something to raise
      // globally just to paper over a slow query elsewhere).
      options?.timeoutMs || options?.maxWaitMs
        ? { timeout: options.timeoutMs, maxWait: options.maxWaitMs }
        : undefined,
    );
  }

  /**
   * Resolve a public widget key to its hotelId. This is the ONE lookup that
   * must run before any tenant context exists (Arch §4 step 1), so it cannot go
   * through `withTenant`. It calls the SECURITY DEFINER `resolve_widget_key`
   * function (migration 3_widget_key_resolver), which bypasses RLS for exactly
   * this narrow exact-key lookup and nothing else. Returns null for an unknown
   * or revoked key.
   */
  async resolveWidgetKey(key: string): Promise<string | null> {
    const rows = await this.$queryRaw<Array<{ hotelId: string | null }>>`
      SELECT resolve_widget_key(${key}) AS "hotelId"
    `;
    return rows[0]?.hotelId ?? null;
  }

  /**
   * Resolve the Hotel rows (id/name/slug) a user has a HotelMembership to.
   * Needed for GET /v1/admin/session (API §3.1), which runs with NO tenant
   * context — an Agency Admin's memberships legitimately span hotels, and this
   * call is itself what discovers which hotel(s) to scope to next. `Hotel` is
   * RLS-scoped, so a plain join would silently return nulls under app_role
   * here; this calls the SECURITY DEFINER `admin_hotels_for_user` function
   * (migration 5_admin_hotel_resolver), which can only ever return hotels the
   * given userId already has a real HotelMembership row for.
   */
  async resolveMemberHotels(
    userId: string,
  ): Promise<Array<{ id: string; name: string; slug: string }>> {
    return this.$queryRaw<Array<{ id: string; name: string; slug: string }>>`
      SELECT * FROM admin_hotels_for_user(${userId})
    `;
  }

  /**
   * Resolve a user's effective `Role` for one specific hotel — their direct
   * `HotelMembership.role` if one exists, else the `OrganizationMembership.role`
   * for that hotel's org (Agency/Super Admin's access path, findings-log.md
   * #22), else `null`. Backs `HotelScopeGuard`'s role-gating (API §3.1,
   * Sprint 4 ticket 8) via the SECURITY DEFINER `admin_hotel_role_for_user`
   * function (migration `9_admin_hotel_org_access`) — same RLS-bypass-for-
   * exactly-this-lookup shape as `resolveMemberHotels`.
   */
  async resolveHotelRole(
    userId: string,
    hotelId: string,
  ): Promise<string | null> {
    const rows = await this.$queryRaw<
      Array<{ admin_hotel_role_for_user: string | null }>
    >`
      SELECT admin_hotel_role_for_user(${userId}, ${hotelId})
    `;
    return rows[0]?.admin_hotel_role_for_user ?? null;
  }

  /**
   * Insert a new `Hotel` row bypassing `Hotel`'s own RLS policy, which no
   * `app_role` connection can otherwise satisfy for a row that doesn't exist
   * yet (findings-log.md #22). Calls the SECURITY DEFINER
   * `admin_create_hotel` function (migration `10_admin_create_hotel`) — role
   * validation and `organizationId` resolution happen in `HotelsService`
   * before this is ever called; this does only the one operation app_role
   * genuinely cannot perform itself.
   */
  async createHotel(
    organizationId: string,
    name: string,
    slug: string,
  ): Promise<{ id: string; name: string; slug: string }> {
    const rows = await this.$queryRaw<
      Array<{ id: string; name: string; slug: string }>
    >`SELECT * FROM admin_create_hotel(${organizationId}, ${name}, ${slug})`;
    return rows[0];
  }
}
