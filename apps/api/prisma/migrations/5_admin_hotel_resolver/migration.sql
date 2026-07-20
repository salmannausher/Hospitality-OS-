-- Admin session hotel resolver — the same chicken-and-egg as
-- 3_widget_key_resolver, on the admin side this time.
--
-- GET /v1/admin/session (API §3.1) has to answer "which hotel(s) does this
-- user have access to" — but it's called with NO tenant context set (an
-- Agency Admin's HotelMembership rows legitimately span multiple hotels, and
-- even a single-hotel admin's session call is exactly the request that
-- DISCOVERS which hotel to scope to — there is no app.hotel_id to set yet).
-- HotelMembership itself is deliberately not RLS-scoped (migration
-- 1_rls_policies' explicit exception), but the "Hotel" row it joins to IS —
-- so a plain Prisma `include: { hotel: true }` silently returns null under
-- app_role with no tenant context, discovered running this live.
--
-- Fix: a narrow SECURITY DEFINER function, scoped to exactly the hotels a
-- given user already has a HotelMembership row for — it can never return a
-- hotel the caller doesn't already have a real membership grant to. Same
-- least-privilege shape as resolve_widget_key.

CREATE OR REPLACE FUNCTION admin_hotels_for_user(p_user_id text)
RETURNS TABLE(id text, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h."id", h."name", h."slug"
  FROM "Hotel" h
  JOIN "HotelMembership" hm ON hm."hotelId" = h."id"
  WHERE hm."userId" = p_user_id;
$$;

REVOKE ALL ON FUNCTION admin_hotels_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_hotels_for_user(text) TO app_role;
