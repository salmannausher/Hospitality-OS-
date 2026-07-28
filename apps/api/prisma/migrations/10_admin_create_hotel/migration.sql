-- Sprint 4, ticket 8 (hotel CRUD, API §3.1) — findings-log.md #22.
--
-- Hotel's own RLS policy (migration 1_rls_policies) is
-- `USING ("id" = current_setting('app.hotel_id', true)::text)`, applied to
-- every command including INSERT (no separate WITH CHECK was declared, so
-- Postgres reuses USING) — a brand-new Hotel row can never satisfy that
-- check under app_role, since there is no app.hotel_id to set to an id that
-- doesn't exist yet. Same chicken-and-egg as the widget-key/session
-- resolvers (migrations 3, 5) — solved the same way: a narrow SECURITY
-- DEFINER function that does only the insert, nothing else. The AGENCY_ADMIN
-- role check and organizationId resolution stay in TypeScript
-- (HotelsService.create) — OrganizationMembership carries no RLS predicate,
-- so that check is already safe as a plain query; this function's only job
-- is the one operation app_role genuinely cannot perform itself.

CREATE OR REPLACE FUNCTION admin_create_hotel(
  p_organization_id text,
  p_name text,
  p_slug text
)
RETURNS TABLE(id text, name text, slug text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO "Hotel" ("id", "organizationId", "name", "slug", "createdAt")
  VALUES (gen_random_uuid()::text, p_organization_id, p_name, p_slug, now())
  RETURNING "id", "name", "slug";
$$;

REVOKE ALL ON FUNCTION admin_create_hotel(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_hotel(text, text, text) TO app_role;
