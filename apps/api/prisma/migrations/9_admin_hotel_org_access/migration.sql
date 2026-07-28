-- Sprint 4, ticket 8 (role-gating, API §3.1) — findings-log.md #22.
--
-- admin_hotels_for_user() (migration 5_admin_hotel_resolver) only ever joined
-- through HotelMembership. But DB §3's own doc comment says
-- OrganizationMembership "grants access across every hotel under an org
-- (Agency Admin / Super Admin)" — a distinct access path from
-- HotelMembership's "exactly one hotel (Hotel Admin / Marketing /
-- Reservations / Viewer)." An Agency/Super Admin with only an
-- OrganizationMembership row resolved to zero hotels, which would have made
-- this ticket's own AGENCY_ADMIN-only hotel creation unreachable by the one
-- role allowed to call it.

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
  WHERE hm."userId" = p_user_id

  UNION

  SELECT h."id", h."name", h."slug"
  FROM "Hotel" h
  JOIN "OrganizationMembership" om ON om."organizationId" = h."organizationId"
  WHERE om."userId" = p_user_id;
$$;

-- Role-gating (same ticket) needs exactly one effective role per request,
-- regardless of which access path granted it: the direct HotelMembership
-- role if one exists, else the OrganizationMembership role for that hotel's
-- org, else NULL. Same least-privilege shape as admin_hotels_for_user —
-- can never return more than the caller's real grants.
CREATE OR REPLACE FUNCTION admin_hotel_role_for_user(p_user_id text, p_hotel_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT hm."role"::text FROM "HotelMembership" hm
       WHERE hm."userId" = p_user_id AND hm."hotelId" = p_hotel_id),
    (SELECT om."role"::text FROM "OrganizationMembership" om
       JOIN "Hotel" h ON h."organizationId" = om."organizationId"
       WHERE om."userId" = p_user_id AND h."id" = p_hotel_id)
  );
$$;

REVOKE ALL ON FUNCTION admin_hotels_for_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_hotels_for_user(text) TO app_role;

REVOKE ALL ON FUNCTION admin_hotel_role_for_user(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_hotel_role_for_user(text, text) TO app_role;
