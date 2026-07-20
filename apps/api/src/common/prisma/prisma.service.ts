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
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.hotel_id', ${hotelId}, true)`;
      // Guarantee the pgvector type/operators resolve for this transaction even
      // on a reused pooler connection (see migration 4_app_role_pgvector_access).
      await tx.$executeRawUnsafe(
        'SET LOCAL search_path TO "$user", public, extensions',
      );
      return fn(tx);
    });
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
}
