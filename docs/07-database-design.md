# Database Design

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [AI Behavior Specification](02-ai-behavior-specification.md) · [Information Architecture](03-information-architecture.md) · [Conversation Playbook](04-conversation-playbook.md) · [User Experience Flows](05-user-experience-flows.md) · [System Architecture Blueprint](06-system-architecture.md)

Every entity, enum, and relationship in this schema was already named somewhere in a prior document — the IA's entity model, the ABS's journey states and confidence bands, the Playbook's scenario schema, the Architecture doc's per-turn logging and tenant-resolution rules. This document is where those become actual tables, types, and indexes. Nothing here should be a surprise; if it is, that's a sign a decision got made in this doc that belongs in an earlier one instead.

---

## 1. Scope & Conventions

- Written as Prisma schema (per the [PRD](01-PRD-ai-concierge.md)'s tech stack) against Postgres + pgvector.
- **Why pgvector over a dedicated vector database** (Pinecone/Weaviate/Qdrant): tenant isolation is the hardest requirement in this system and it's already solved once, in Postgres, via row-level security (§9) — a separate vector store would need its own isolation mechanism (namespaces/partitions) and its own consistency guarantee with the relational data (deleting a hotel's document would mean deleting from two databases atomically instead of one). Retrieval also needs vector similarity and structured filtering in the same query ([IA §7](03-information-architecture.md) — domain tags + entity joins + similarity), which is one SQL statement in Postgres and a cross-system round trip otherwise. And retrieval is always hotel-scoped, so no single query ever searches more than one property's few-thousand-chunk knowledge base — the scale argument for a dedicated vector product (huge single-index ANN performance) doesn't apply here even at "1,000+ hotels" platform scale. The honest cost of this choice: less turnkey reranking/hybrid-search tooling than a dedicated product (built into the orchestrator instead), and ingestion's write load shares the same Postgres instance as live chat traffic — worth revisiting (read replica, or splitting ingestion onto its own connection pool) if ingestion volume grows large, per the scaling note in [Architecture §8](06-system-architecture.md).
- Every tenant-scoped table carries `hotelId` **directly**, even where it could be derived via a join (e.g. `Message` could reach `hotelId` through `Conversation` — it's denormalized anyway). This isn't redundancy for its own sake: [Architecture §6](06-system-architecture.md) requires row-level security as a hard predicate on `hotel_id` per table, and RLS policies are simplest and fastest when they don't need a join to evaluate.
- IDs are `cuid()` throughout — sortable-enough, collision-safe, no coordination needed across the ingestion worker and API writing to the same tables.
- Prisma has two real gaps this schema has to work around, both called out inline: no native pgvector type, and no polymorphic relations. Neither is a schema design flaw — they're Prisma limitations with well-established workarounds, flagged so nobody rediscovers them mid-migration.
- **Soft delete, not hard delete**, on every table an admin can remove a row from and where something downstream might reference it later (documents, the nine structured entities in §6, leads). These carry a `deletedAt DateTime?` and application queries filter `WHERE deletedAt IS NULL` by default — recoverable-by-default matters for enterprise hotel clients who will ask "can you restore what we accidentally deleted," and it keeps an audit trail (§13) meaningful instead of pointing at rows that no longer exist. Append-only tables (`Message`, `Escalation`, `AuditLog` itself) don't need it — nothing ever deletes a historical chat turn.
- **No password field anywhere in this schema.** Authentication is delegated to the external identity provider already named in the [PRD](01-PRD-ai-concierge.md)'s tech stack (Supabase Auth / Clerk) — credential storage, hashing, and reset flows are exactly the kind of security-critical plumbing worth not re-implementing. `User.id` here is the provider's user id, not a locally-owned credential record.

## 2. ERD — High Level

```
┌─────────────────┐        ┌──────────────┐
│  Organization     │──────▶│  Hotel        │  (tenant root — everything below hangs off Hotel)
└─────────────────┘        └──────┬───────┘
                                   │
        ┌───────────────┬─────────┼─────────────┬──────────────────┐
        │               │         │             │                  │
┌───────▼──────┐ ┌──────▼─────┐ ┌─▼───────────┐ ┌▼────────────────┐ ┌▼──────────────┐
│ Access         │ │ Brand /    │ │ Knowledge    │ │ Conversations    │ │ QA / Playbook  │
│ (User,         │ │ Prompt     │ │ Base         │ │ (Conversation,   │ │ (QAScore,      │
│  Membership,   │ │ (Brand-    │ │ (Document,   │ │  Message, Lead,  │ │  Playbook-     │
│  WidgetKey)    │ │  Settings, │ │  Chunk,      │ │  Escalation)     │ │  Scenario)     │
│                │ │  Prompt-   │ │  9 entity    │ │                  │ │                │
│                │ │  Override) │ │  tables,     │ │                  │ │                │
│                │ │            │ │  Entity-     │ │                  │ │                │
│                │ │            │ │  Relation-   │ │                  │ │                │
│                │ │            │ │  ship,       │ │                  │ │                │
│                │ │            │ │  Ingestion-  │ │                  │ │                │
│                │ │            │ │  Job)        │ │                  │ │                │
└──────────────┘ └────────────┘ └─────────────┘ └────────────────┘ └──────────────┘

                       plus, hanging off Hotel directly (§13):
                       AuditLog · Notification · Integration · Subscription · DailyMetric
```

## 3. Access & Tenancy

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String                          // e.g. "Spherical"
  createdAt DateTime @default(now())

  hotels      Hotel[]
  memberships OrganizationMembership[]
}

model Hotel {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  slug           String       @unique
  createdAt      DateTime     @default(now())

  brandSettings        BrandSettings?
  promptOverrides       PromptOverride[]
  propertyProfile       PropertyProfile?
  widgetKeys            WidgetKey[]
  memberships           HotelMembership[]
  documents             Document[]
  chunks                Chunk[]
  entityRelationships   EntityRelationship[]
  roomTypes             RoomType[]
  packages              Package[]
  restaurants           Restaurant[]
  spaTreatments         SpaTreatment[]
  amenities             Amenity[]
  policies              Policy[]
  localRecommendations  LocalRecommendation[]
  eventSpaces           EventSpace[]
  experiences           Experience[]
  conversations         Conversation[]
  leads                 Lead[]
  playbookScenarios     PlaybookScenario[]
  auditLogs             AuditLog[]
  notifications         Notification[]
  integrations          Integration[]
  subscription          Subscription?
  dailyMetrics          DailyMetric[]

  @@index([organizationId])
}

enum Role {
  SUPER_ADMIN
  AGENCY_ADMIN
  HOTEL_ADMIN
  MARKETING
  RESERVATIONS
  VIEWER
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())

  organizationMemberships OrganizationMembership[]
  hotelMemberships        HotelMembership[]
}

/// Grants access across every hotel under an org (Agency Admin / Super Admin) — PRD §16
model OrganizationMembership {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           Role
  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
}

/// Grants access to exactly one hotel (Hotel Admin / Marketing / Reservations / Viewer) — PRD §16
model HotelMembership {
  id      String @id @default(cuid())
  userId  String
  hotelId String
  role    Role
  user    User   @relation(fields: [userId], references: [id])
  hotel   Hotel  @relation(fields: [hotelId], references: [id])

  @@unique([userId, hotelId])
  @@index([hotelId])
}

/// Public, scoped identifier used to resolve hotel_id from the guest widget — Architecture §6.
/// The chat API never trusts a client-supplied hotel id; it looks it up from this key instead.
model WidgetKey {
  id        String   @id @default(cuid())
  hotelId   String
  key       String   @unique
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
  hotel     Hotel    @relation(fields: [hotelId], references: [id])

  @@index([hotelId])
}
```

## 4. Brand & Prompt Configuration

```prisma
enum TonePreset {
  CLASSIC_LUXURY
  MODERN_LUXURY
  BOUTIQUE
  FAMILY_FRIENDLY
}

/// ABS §2 — per-hotel persona config. Every field here is a template variable in the
/// system prompt (ABS §14), not decorative admin-panel content.
model BrandSettings {
  id             String     @id @default(cuid())
  hotelId        String     @unique
  hotel          Hotel      @relation(fields: [hotelId], references: [id])

  conciergeName  String                       // ABS §2 avatar name
  tonePreset     TonePreset @default(MODERN_LUXURY)
  formalityNote  String?                      // free-text override beyond the preset
  emojiAllowed   Boolean    @default(false)
  signOff        String?
  greeting       String                       // Welcome message — PRD FR-001 / Playbook G-00
  logoUrl        String?
  primaryColor   String?
  secondaryColor String?
  fontFamily     String?

  updatedAt      DateTime   @updatedAt
}

/// Read-mostly, edit-guarded escape hatch beyond the generated prompt (ABS §14) — most hotels
/// never touch this; it exists for the rare bespoke case the template can't express.
/// Versioned rather than a single row per hotel: exactly one `active` version is live at a
/// time, so a prompt change can be drafted, previewed, and rolled back without losing the
/// previous working version — the same reasoning as never hard-deleting a knowledge document.
model PromptOverride {
  id           String   @id @default(cuid())
  hotelId      String
  hotel        Hotel    @relation(fields: [hotelId], references: [id])
  name         String                     // e.g. "v2 - warmer tone", admin-facing label
  overrideText String
  model        String?                    // AI Gateway "provider/model" string, Architecture §7
  temperature  Float?
  active       Boolean  @default(false)
  updatedBy    String
  updatedAt    DateTime @updatedAt

  @@index([hotelId, active])
}
```

## 5. Knowledge Base — Documents, Ingestion, Chunks

```prisma
enum DocumentSourceType {
  PDF
  DOCX
  TEXT
  URL
}

enum DocumentStatus {
  PARSING
  NEEDS_REVIEW
  FAILED
  INDEXED
}

model Document {
  id           String             @id @default(cuid())
  hotelId      String
  hotel        Hotel              @relation(fields: [hotelId], references: [id])
  filename     String
  sourceType   DocumentSourceType
  storageUrl   String
  status       DocumentStatus     @default(PARSING)
  sourceUrl    String?                          // for URL-synced content, IA §4
  lastSyncedAt DateTime?
  uploadedAt   DateTime           @default(now())
  deletedAt    DateTime?                        // soft delete — see §1

  chunks        Chunk[]
  ingestionJobs IngestionJob[]

  @@index([hotelId, status])
}

enum IngestionStage {
  PARSING
  EXTRACTING
  CHUNKING
  TAGGING
  EMBEDDING
  VALIDATING
}

enum JobStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
}

/// Architecture §5 — one row per stage attempt, so a failed upload is diagnosable
/// ("embedding failed" vs "parsing failed") without re-running the whole pipeline blind.
model IngestionJob {
  id          String         @id @default(cuid())
  hotelId     String
  documentId  String
  document    Document       @relation(fields: [documentId], references: [id])
  stage       IngestionStage
  status      JobStatus      @default(QUEUED)
  error       String?
  startedAt   DateTime?
  completedAt DateTime?

  @@index([hotelId])
  @@index([documentId])
}

enum Priority {
  HIGH
  NORMAL
  LOW
}

/// IA §6 — the retrievable unit. `embedding` uses Prisma's Unsupported() escape hatch since
/// Prisma has no native pgvector type — see §8 for the raw-SQL migration this requires.
model Chunk {
  id             String             @id @default(cuid())
  hotelId        String
  hotel          Hotel              @relation(fields: [hotelId], references: [id])
  documentId     String
  document       Document           @relation(fields: [documentId], references: [id])
  domainTags     String[]                        // IA §2 taxonomy values
  sourceType     DocumentSourceType
  language       String             @default("en")
  priority       Priority           @default(NORMAL)
  lastVerifiedAt DateTime           @default(now())   // drives staleness, IA §9
  content        String
  tokenCount     Int?                                // precomputed for context-window budgeting at generation time (ABS §14)
  embedding      Unsupported("vector(1024)")

  @@index([hotelId, priority])
}
```

## 6. Structured Entities (IA §3)

Nine tables, one per entity type — kept as real relational tables rather than one polymorphic JSON blob, because the Recommendation Engine ([PRD FR-005](01-PRD-ai-concierge.md)) needs to filter on typed fields (capacity, price, duration), not re-parse text at answer time. All nine carry `deletedAt` (soft delete, §1).

```prisma
model RoomType {
  id           String    @id @default(cuid())
  hotelId      String
  hotel        Hotel     @relation(fields: [hotelId], references: [id])
  name         String
  view         String?
  capacity     Int
  bedConfig    String?
  accessible   Boolean   @default(false)
  baseRateLow  Decimal?
  baseRateHigh Decimal?
  deletedAt    DateTime?

  @@index([hotelId])
}

model Package {
  id            String    @id @default(cuid())
  hotelId       String
  hotel         Hotel     @relation(fields: [hotelId], references: [id])
  name          String
  includedItems String[]
  validFrom     DateTime?
  validTo       DateTime?
  priceLow      Decimal?
  priceHigh     Decimal?
  roomTypeIds   String[]                     // loose reference, see §8 note
  deletedAt     DateTime?

  @@index([hotelId])
}

model Restaurant {
  id                String    @id @default(cuid())
  hotelId           String
  hotel             Hotel     @relation(fields: [hotelId], references: [id])
  name              String
  cuisine           String?
  hours             String?
  dressCode         String?
  dietaryTags       String[]
  reservationPolicy String?
  deletedAt         DateTime?

  @@index([hotelId])
}

model SpaTreatment {
  id           String    @id @default(cuid())
  hotelId      String
  hotel        Hotel     @relation(fields: [hotelId], references: [id])
  name         String
  durationMins Int?
  price        Decimal?
  facility     String?
  deletedAt    DateTime?

  @@index([hotelId])
}

model Amenity {
  id         String    @id @default(cuid())
  hotelId    String
  hotel      Hotel     @relation(fields: [hotelId], references: [id])
  name       String
  hours      String?
  location   String?
  accessRule String?
  deletedAt  DateTime?

  @@index([hotelId])
}

model Policy {
  id         String    @id @default(cuid())
  hotelId    String
  hotel      Hotel     @relation(fields: [hotelId], references: [id])
  topic      String                          // "pets" | "cancellation" | ... — IA §3
  ruleText   String
  exceptions String?
  deletedAt  DateTime?

  @@index([hotelId, topic])
}

model LocalRecommendation {
  id           String    @id @default(cuid())
  hotelId      String
  hotel        Hotel     @relation(fields: [hotelId], references: [id])
  name         String
  category     String?
  distanceNote String?
  curationNote String?
  deletedAt    DateTime?

  @@index([hotelId])
}

model EventSpace {
  id              String    @id @default(cuid())
  hotelId         String
  hotel           Hotel     @relation(fields: [hotelId], references: [id])
  name            String
  capacity        Int?
  layoutOptions   String[]
  avEquipment     String[]
  cateringMinimum Decimal?
  deletedAt       DateTime?

  @@index([hotelId])
}

model Experience {
  id             String    @id @default(cuid())
  hotelId        String
  hotel          Hotel     @relation(fields: [hotelId], references: [id])
  name           String
  category       String?                     // on-site | off-site — IA §3
  durationMins   Int?
  price          Decimal?
  bookingLeadHrs Int?
  ageRestriction String?
  deletedAt      DateTime?

  @@index([hotelId])
}

/// Singleton per hotel — IA §3. About/brand story/awards content, PLUS a small set of
/// "quick facts" (checkIn/checkOut, pet policy, star rating, airport distance) that get
/// injected into the system prompt (ABS §14) unconditionally on every turn, bypassing
/// retrieval entirely. This is deliberate: these are the handful of facts nearly every guest
/// asks, they're simple key/value pairs (not paragraphs), and routing them through vector
/// search adds latency and a retrieval-miss risk for questions that should never miss.
/// Everything else about the property still goes through Chunk/RAG as normal.
model PropertyProfile {
  id                  String    @id @default(cuid())
  hotelId             String    @unique
  hotel               Hotel     @relation(fields: [hotelId], references: [id])
  brandStory          String?
  history             String?
  location            String?
  contactInfo         String?
  galleryRefs         String[]
  awards              String[]

  // Quick facts — always-inject, never retrieved (see doc comment above)
  checkInTime         String?
  checkOutTime        String?
  petFriendly         Boolean?
  starRating          Int?
  airportDistanceNote String?
  quickFactAmenities  String[]                 // short glance-list; full detail still lives in Amenity rows
}
```

## 7. Relationship Layer (IA §12)

```prisma
enum EntityType {
  ROOM_TYPE
  PACKAGE
  RESTAURANT
  SPA_TREATMENT
  AMENITY
  POLICY
  LOCAL_RECOMMENDATION
  EVENT_SPACE
  EXPERIENCE
  PROPERTY_PROFILE
}

/// IA §12 — curated edges between entities (the "Hotel Knowledge Graph, lightweight V1").
/// `fromEntityId`/`toEntityId` carry no FK constraint — see §8, this is deliberate.
model EntityRelationship {
  id               String     @id @default(cuid())
  hotelId          String
  hotel            Hotel      @relation(fields: [hotelId], references: [id])
  fromEntityType   EntityType
  fromEntityId     String
  toEntityType     EntityType
  toEntityId       String
  relationshipType String                     // "pairs_with" | "suitable_for" | "near"
  contextTag       String                      // "anniversary" | "family" | "honeymoon" ...
  priority         Priority   @default(NORMAL)

  @@index([hotelId, contextTag])
}
```

## 8. Two Prisma Gaps, Handled Explicitly

**No native pgvector type.** `Chunk.embedding` is declared `Unsupported("vector(1024)")` — Prisma Client won't let you query it directly; retrieval (Architecture §4, step 5) uses `$queryRaw` for the similarity search itself, with Prisma handling everything else about the `Chunk` row normally. The vector dimension (`1024` here) must match the embedding model actually chosen at implementation time (Voyage AI — [PRD](01-PRD-ai-concierge.md) tech stack) — it isn't a schema opinion, it's a constant that has to match the model.

**No polymorphic relations.** `EntityRelationship.fromEntityId`/`toEntityId` and `Package.roomTypeIds` reference rows in one of several different tables depending on the accompanying `EntityType` — Prisma has no way to express "this foreign key points at whichever table this enum says." These are stored as plain string IDs with no database-level FK constraint, validated at the application layer instead. This is a known, common pattern, not an oversight — the alternative (a separate nullable FK column per possible entity type) is worse here given ten entity types.

## 9. Row-Level Security — Where It Actually Lives

Prisma schema can't declare RLS policies — they're applied as raw SQL in a migration, referenced here so the two documents stay in sync with each other rather than drifting:

```sql
-- Applied once per tenant-scoped table (Hotel, Document, Chunk, Conversation, Lead, ...)
ALTER TABLE "Chunk" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Chunk"
  USING ("hotelId" = current_setting('app.hotel_id')::text);
```

The application sets `app.hotel_id` as a session variable at the start of every request, using the value resolved in [Architecture §6](06-system-architecture.md) (from the widget key for guest traffic, from the authenticated membership for admin traffic) — this is the mechanism, not just the policy declaration, that makes it structurally impossible for a forgotten `WHERE hotelId = ...` in application code to leak cross-tenant rows.

**The policies above do nothing if the application connects as the table owner.** Discovered running Sprint 0's adversarial RLS test ([Sprint Backlog](14-sprint-backlog.md)), not something this document originally called out: Postgres table owners bypass row-level security by default, regardless of how many policies exist, unless `FORCE ROW LEVEL SECURITY` is set — and the role that runs migrations necessarily owns every table it creates. The fix is a second, deliberately restricted role (`app_role`: `NOSUPERUSER NOBYPASSRLS`, granted only `SELECT/INSERT/UPDATE/DELETE` on the schema, never ownership) that the *application* connects as at runtime — migrations still run as the owning role. This is now its own tracked migration (`2_app_role`), applied alongside the RLS policies (`1_rls_policies`) rather than left as an unstated assumption. The adversarial test — two hotels, a session scoped to Hotel A querying as `app_role` — confirmed Hotel B's rows are completely invisible only once this separation was in place; using the owning role for the same test would have silently passed for the wrong reason (no RLS bypass check at all, not genuine isolation).

## 10. Conversations, Leads, Escalations

```prisma
/// Lowercase values, deliberately — matching the wire/prompt-facing form used
/// everywhere else this concept appears (ABS §16, Playbook §2, API §2.1,
/// AI Engine §2), not Prisma's usual UPPER_SNAKE_CASE convention. Every other
/// enum in this schema stays uppercase; this is the one deliberate exception,
/// made once here rather than needing a translation layer at the API boundary.
enum JourneyState {
  information
  planning
  booking_intent
  service_recovery
}

enum ConfidenceBand {
  HIGH
  MEDIUM
  LOW
}

enum ConversationStatus {
  ACTIVE
  ESCALATED
  CLOSED
}

/// `guestSessionId` is deliberately the only guest identifier here, and deliberately
/// session-scoped rather than a longer-lived `visitorId`/device fingerprint that could
/// correlate multiple sessions from the same browser. That's not an oversight — a persistent
/// visitor identifier is exactly the infrastructure a "welcome back" returning-guest feature
/// would need, and that feature was explicitly rejected for V1 on privacy grounds (ABS §11,
/// UX §7). Don't reintroduce it here without revisiting that decision first.
model Conversation {
  id             String             @id @default(cuid())
  hotelId        String
  hotel          Hotel              @relation(fields: [hotelId], references: [id])
  guestSessionId String                          // anonymous, session-scoped — no guest account (ABS §11)
  status         ConversationStatus @default(ACTIVE)
  startedAt      DateTime           @default(now())
  endedAt        DateTime?

  messages    Message[]
  leads       Lead[]
  escalations Escalation[]
  qaScore     QAScore?

  @@index([hotelId, startedAt])
}

enum MessageRole {
  GUEST
  CONCIERGE
}

/// Architecture §4 step 9 — every field here is what powers the Analytics "Missing
/// Information" panel (UX §12) and the QA Rubric (ABS §15), not just chat history.
model Message {
  id                   String          @id @default(cuid())
  hotelId              String
  conversationId       String
  conversation         Conversation    @relation(fields: [conversationId], references: [id])
  role                 MessageRole
  content              String
  journeyState         JourneyState?               // set on concierge turns only
  domainTags           String[]
  confidenceBand       ConfidenceBand?
  escalationTriggered  Boolean         @default(false)
  leadCaptureTriggered Boolean         @default(false)
  createdAt            DateTime        @default(now())

  @@index([hotelId])
  @@index([conversationId, createdAt])
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  CONVERTED
  LOST
}

/// Fields mirror PRD FR-007 in full — this is the available menu, not a checklist to fill
/// every time. UX §4 caps what's actually asked for in a single conversation at 2-3 fields.
model Lead {
  id              String        @id @default(cuid())
  hotelId         String
  hotel           Hotel         @relation(fields: [hotelId], references: [id])
  conversationId  String?
  conversation    Conversation? @relation(fields: [conversationId], references: [id])
  name            String?
  email           String?
  phone           String?
  travelDates     String?
  budget          String?
  guestCount      Int?
  reasonForStay   String?
  preferredRoom   String?
  consentGiven    Boolean       @default(false)
  status          LeadStatus    @default(NEW)
  leadScore       Int?                          // 0-100, drives the Conversations list triage view (UX §11)
  assignedOwnerId String?
  notes           String?
  createdAt       DateTime      @default(now())
  deletedAt       DateTime?

  @@index([hotelId, status])
}

/// ABS §7 — one row per handoff, so escalation-reason analytics (PRD FR-010) are a
/// group-by on a structured tag, not a text search over transcripts.
model Escalation {
  id             String       @id @default(cuid())
  hotelId        String
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  reason         String                          // structured tag, ABS §7 — never free text
  triggeredAt    DateTime     @default(now())
  resolvedAt     DateTime?
  handledBy      String?

  @@index([hotelId, reason])
}
```

## 11. QA & Playbook

```prisma
/// ABS §15 — one score per conversation at v1; could move to per-message grain later if
/// pilot data shows a single conversation-level score is too coarse.
model QAScore {
  id             String       @id @default(cuid())
  hotelId        String
  conversationId String       @unique
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  grounding      Int
  tone           Int
  escalation     Int
  leadCapture    Int
  resolution     Int
  scoredBy       String
  scoredAt       DateTime     @default(now())

  @@index([hotelId])
}

enum ScenarioSource {
  HAND_WRITTEN
  PILOT_TRANSCRIPT
}

/// Playbook §2 schema, persisted directly — `hotelId` null for the global v1 scenarios
/// (Playbook §4/§5), set when a scenario was flagged from a specific hotel's real transcript
/// via "Flag for Playbook" (UX §11 / Playbook §7). This table *is* the eval schema — there is
/// deliberately no separate eval data model per Architecture §9.
model PlaybookScenario {
  id                   String         @id @default(cuid())
  hotelId              String?
  hotel                Hotel?         @relation(fields: [hotelId], references: [id])
  domain               String?
  journeyState         JourneyState
  persona              String?
  guestMessage         String
  expectedBehavior     String[]
  escalationExpected   Boolean        @default(false)
  leadCaptureExpected  Boolean        @default(false)
  mustNot              String[]
  source               ScenarioSource @default(HAND_WRITTEN)
  sourceConversationId String?

  @@index([hotelId, journeyState])
}
```

## 12. Indexing Notes Beyond What's Inline Above

- **`Chunk.embedding`** needs an HNSW (or IVFFlat) index, created via raw SQL migration since Prisma can't declare pgvector index types: `CREATE INDEX ON "Chunk" USING hnsw (embedding vector_cosine_ops);`. In practice this should be a **partial or composite index scoped by `hotelId`**, not one global index across every tenant's chunks — retrieval always filters by tenant first ([IA §7](03-information-architecture.md)), so the index should be shaped around that access pattern from day one rather than needing a rebuild once there are enough hotels for it to matter.
- **`domainTags` (String[])** columns benefit from a GIN index for containment queries (`WHERE domainTags @> ARRAY['spa']`) — relevant on `Chunk` and `Message`, both queried by domain constantly (retrieval filtering and the Analytics "Guests Ask Most About" panel, respectively).
- Every `@@index([hotelId, ...])` above is deliberately hotel-first in its column order — this matches how every query in the system is actually shaped (tenant-scoped first, then filtered further), and it's what makes the RLS predicate in §9 cheap to evaluate rather than a sequential scan.

## 13. Operational Tables — Audit, Notifications, Integrations, Billing, Daily Metrics

Five tables that don't trace back to a single prior document the way everything above does — they close gaps between screens/requirements already named elsewhere (the Admin nav's Integrations and Billing items in [UX §8](05-user-experience-flows.md), audit logging promised in [Architecture §10](06-system-architecture.md), notifications listed in [PRD §14](01-PRD-ai-concierge.md), and the Analytics dashboard in [UX §12](05-user-experience-flows.md)) that had no backing table until now.

```prisma
/// Architecture §10 said brand/prompt/knowledge changes get audit-logged — this is that table.
/// One row per mutating admin action, never deleted (append-only, no soft-delete needed).
model AuditLog {
  id         String   @id @default(cuid())
  hotelId    String?                       // null for org-level actions
  hotel      Hotel?   @relation(fields: [hotelId], references: [id])
  actorId    String                        // User.id
  action     String                        // "document.uploaded" | "prompt.activated" | "brand.updated" | ...
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())

  @@index([hotelId, createdAt])
}

enum NotificationType {
  NEW_LEAD
  ESCALATION
  INGESTION_FAILED
  SYSTEM_ERROR
  WEEKLY_REPORT
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
}

/// PRD §14 lists these five notification types; this is the table that backs them.
model Notification {
  id          String              @id @default(cuid())
  hotelId     String
  hotel       Hotel               @relation(fields: [hotelId], references: [id])
  type        NotificationType
  recipientId String                        // User.id
  payload     Json
  status      NotificationStatus  @default(PENDING)
  createdAt   DateTime            @default(now())

  @@index([hotelId, status])
}

enum IntegrationProvider {
  CLOUDBEDS
  MEWS
  OPERA
  SALESFORCE
  HUBSPOT
}

enum IntegrationStatus {
  NOT_CONNECTED
  CONNECTED
  ERROR
}

/// Stubbed now, functional in V2+ (PRD §18 — PMS/CRM integration is explicitly out of MVP
/// scope). Exists as a table today only because the "Integrations" admin screen (UX §8)
/// already needs somewhere to render "not connected" rather than nothing at all. `apiKey`
/// here is a reference to a secret in the platform's secret manager (Architecture §10),
/// never a plaintext credential in this table.
model Integration {
  id            String              @id @default(cuid())
  hotelId       String
  hotel         Hotel               @relation(fields: [hotelId], references: [id])
  provider      IntegrationProvider
  status        IntegrationStatus   @default(NOT_CONNECTED)
  secretRef     String?
  configuration Json?
  updatedAt     DateTime            @updatedAt

  @@unique([hotelId, provider])
}

enum SubscriptionPlan {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
}

/// Backs the "Billing" admin screen (UX §8), which — like Integrations above — already
/// existed as a nav item with nothing behind it. Plan tiers match the productized platform
/// packaging (Starter/Professional/Enterprise) from the original business-case discussion.
model Subscription {
  id             String             @id @default(cuid())
  hotelId        String             @unique
  hotel          Hotel              @relation(fields: [hotelId], references: [id])
  plan           SubscriptionPlan   @default(STARTER)
  status         SubscriptionStatus @default(ACTIVE)
  monthlyRate    Decimal?
  startedAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
}

/// Pre-aggregated daily rollup — the Dashboard KPI tiles and Analytics screen (UX §8, §12)
/// read from this, not from a live COUNT/GROUP BY over Message/Conversation/Lead. At "1,000+
/// hotels" scale (PRD §17), recomputing those aggregates from raw tables on every dashboard
/// load is exactly the kind of query the Architecture doc's scaling note already flagged as
/// the real long-term bottleneck — this table is computed once per hotel per day (batch job
/// or incrementally on write) instead of recalculated on every page view.
model DailyMetric {
  id                 String   @id @default(cuid())
  hotelId            String
  hotel              Hotel    @relation(fields: [hotelId], references: [id])
  date               DateTime                     // truncated to day
  messageCount       Int      @default(0)
  conversationCount  Int      @default(0)
  bookingIntentCount Int      @default(0)
  leadCount          Int      @default(0)
  escalationCount    Int      @default(0)
  avgSatisfaction    Float?

  @@unique([hotelId, date])
}
```

## 14. What This Schema Deliberately Doesn't Model Yet

Consistent with [PRD §19](01-PRD-ai-concierge.md)'s MVP scope: no booking-engine/PMS tables (no `Booking` or `Payment` model — the Booking CTA is an external link, not a transaction this database records), no cross-session guest identity (`guestSessionId` on `Conversation` is intentionally opaque and session-scoped, not a `Guest` table with a persistent profile — see [UX §7](05-user-experience-flows.md)'s explicit V1 exclusion of returning-guest memory), and no multi-language content tables beyond the `language` field already on `Chunk` ([IA §11](03-information-architecture.md)).

---

**Next document:** [UI Design System](08-ui-design-system.md) — the visual language (color, type, components) that renders every screen and state already specified in the [UX Flows](05-user-experience-flows.md) document, using the entities and structure defined here as the actual data behind each mockup.
