-- Per-key CORS scoping (findings-log.md #39). Adds the allowedOrigins column
-- WidgetKey needed, plus a second narrow SECURITY DEFINER resolver alongside
-- resolve_widget_key (migration 3_widget_key_resolver) that also returns it —
-- app_role has no tenant context yet at this lookup, same chicken-and-egg
-- that function's own comment describes, so a plain SELECT on WidgetKey
-- can't be used here either. resolve_widget_key itself is left untouched
-- (existing callers depend on its scalar-text return shape); this is an
-- additive function, not a replacement.

ALTER TABLE "WidgetKey" ADD COLUMN "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE OR REPLACE FUNCTION resolve_widget_key_full(p_key text)
RETURNS TABLE("hotelId" text, "allowedOrigins" text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "hotelId", "allowedOrigins"
  FROM "WidgetKey"
  WHERE "key" = p_key AND "revoked" = false
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_widget_key_full(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_widget_key_full(text) TO app_role;
