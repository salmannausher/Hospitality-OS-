-- Restricted runtime role. RLS policies (migration 1_rls_policies) do
-- nothing if the application connects as the table owner — Postgres table
-- owners bypass row-level security by default, and the "postgres" role used
-- for migrations owns every table created so far. This role is what the
-- actual application (apps/api's PrismaClient, once built) connects as at
-- runtime, so RLS is actually enforced rather than silently bypassed by
-- superuser/ownership privilege. Discovered while running Sprint 0's
-- adversarial RLS test (docs/14-sprint-backlog.md) — not something the
-- original schema/architecture docs called out explicitly.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role WITH LOGIN PASSWORD 'REPLACE_ME_VIA_ALTER_ROLE' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- Future tables from later migrations get the same grants automatically —
-- otherwise every new model added to schema.prisma silently has no grants
-- for the role that actually needs to query it.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_role;
