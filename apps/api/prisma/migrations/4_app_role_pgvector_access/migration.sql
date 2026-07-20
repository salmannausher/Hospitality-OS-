-- Let the runtime role reach pgvector. Supabase installs the `vector` extension
-- in the `extensions` schema (not public), and the restricted `app_role`
-- (migration 2_app_role) has neither USAGE on that schema nor it on its
-- search_path — so `::vector`, the `<=>` operator, and vector_cosine_ops all
-- fail with `type "vector" does not exist` at query time, even though the
-- owner (which runs migrations and the seed) resolves them fine.
--
-- Discovered running the Sprint 1 retrieval path as app_role. The per-tenant
-- transaction in PrismaService.withTenant additionally issues `SET LOCAL
-- search_path` so this holds even on a reused transaction-pooler connection
-- whose default path predates this ALTER.

GRANT USAGE ON SCHEMA extensions TO app_role;

-- Default path for fresh app_role connections. "$user" first (Postgres default),
-- then public (our tables), then extensions (the vector type/operators).
ALTER ROLE app_role SET search_path = "$user", public, extensions;
