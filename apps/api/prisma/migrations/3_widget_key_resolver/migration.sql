-- Widget-key → hotelId resolver — the one lookup that must bypass RLS.
--
-- The guest Chat API resolves a widget key to a hotelId BEFORE it knows the
-- tenant (Architecture §4 step 1). But WidgetKey has RLS enabled with the same
-- `hotelId = current_setting('app.hotel_id', true)` predicate as every other
-- table (migration 1_rls_policies), and the runtime connects as `app_role`
-- (NOSUPERUSER NOBYPASSRLS, migration 2_app_role). With no tenant context set
-- yet, app_role sees ZERO WidgetKey rows — a chicken-and-egg the security model
-- as built can't resolve on its own.
--
-- Fix: a narrow SECURITY DEFINER function, owned by the migration role
-- (postgres, which bypasses RLS), that resolves EXACTLY one key to its hotelId
-- and nothing else. app_role gets EXECUTE only — it stays NOBYPASSRLS for every
-- other table. This is the standard Postgres idiom for bootstrapping tenant
-- context, and it honors Architecture §6's "looked-up mapping, never
-- client-supplied" exactly: the caller must already possess the key, and the
-- function returns only the hotel that key belongs to.
--
-- Not in the original schema/architecture docs — discovered building the
-- Sprint 1 runtime path, the same way app_role itself was discovered in
-- Sprint 0. Documented here rather than in a scattered inline query.

CREATE OR REPLACE FUNCTION resolve_widget_key(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "hotelId"
  FROM "WidgetKey"
  WHERE "key" = p_key AND "revoked" = false
  LIMIT 1;
$$;

-- Least privilege: nobody executes this except the runtime role.
REVOKE ALL ON FUNCTION resolve_widget_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_widget_key(text) TO app_role;
