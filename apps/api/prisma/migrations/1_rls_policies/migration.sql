-- Row-level security policies — docs/07-database-design.md §9.
-- Applied as a follow-up migration after the initial `prisma migrate dev`
-- (Prisma can't declare RLS in schema.prisma — this is exactly why this file
-- is separate rather than embedded there). Run once DATABASE_URL is real:
--
--   pnpm --filter api exec prisma migrate dev --create-only --name rls_policies
--   (paste this file's contents into the generated migration.sql)
--   pnpm --filter api exec prisma migrate dev
--
-- Every tenant-scoped table gets the same predicate: hotelId (or, for Hotel
-- itself, id) must equal the session's app.hotel_id — set by the application
-- at the start of every request (Architecture §6), never client-supplied.
-- Sprint 0's adversarial test (docs/14-sprint-backlog.md) checks this directly:
-- a session scoped to Hotel A must not be able to read a single row from Hotel B.

-- Tenant root
ALTER TABLE "Hotel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Hotel"
  USING ("id" = current_setting('app.hotel_id', true)::text);

-- Brand / Prompt configuration
ALTER TABLE "BrandSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BrandSettings"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "PromptOverride" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PromptOverride"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "PropertyProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PropertyProfile"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "WidgetKey" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WidgetKey"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

-- Knowledge base
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Document"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "IngestionJob" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "IngestionJob"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Chunk" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Chunk"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

-- Structured entities (IA §3 / DB §6)
ALTER TABLE "RoomType" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RoomType"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Package"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Restaurant"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "SpaTreatment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SpaTreatment"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Amenity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Amenity"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Policy" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Policy"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "LocalRecommendation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LocalRecommendation"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "EventSpace" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EventSpace"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Experience" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Experience"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "EntityRelationship" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EntityRelationship"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

-- Conversations, leads, escalations
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Conversation"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Message"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Lead"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Escalation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Escalation"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

-- QA & Playbook
ALTER TABLE "QAScore" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "QAScore"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

-- PlaybookScenario.hotelId is nullable (global v1 scenarios have no hotel) —
-- the policy must allow those through as well as hotel-scoped ones.
ALTER TABLE "PlaybookScenario" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PlaybookScenario"
  USING ("hotelId" IS NULL OR "hotelId" = current_setting('app.hotel_id', true)::text);

-- Operational tables (§13)
-- AuditLog.hotelId is nullable (org-level actions) — same allow-null pattern.
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("hotelId" IS NULL OR "hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Notification"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Integration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Integration"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Subscription"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

ALTER TABLE "DailyMetric" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DailyMetric"
  USING ("hotelId" = current_setting('app.hotel_id', true)::text);

-- Explicitly NOT scoped by RLS: Organization, User, OrganizationMembership,
-- HotelMembership — these are the identity/membership layer that RLS policies
-- above depend on to resolve app.hotel_id in the first place, and access to
-- them is governed by application-layer authorization (API §3.1), not a
-- single-tenant predicate (an Agency Admin's own membership rows legitimately
-- span multiple hotels).

-- pgvector index — hotel-scoped per DB §12, not one global index across every
-- tenant's chunks. Run after the RLS policies above.
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
  ON "Chunk" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunk_domain_tags_gin_idx
  ON "Chunk" USING gin ("domainTags");

CREATE INDEX IF NOT EXISTS message_domain_tags_gin_idx
  ON "Message" USING gin ("domainTags");
