// @hospitality/types — shared TypeScript types across apps/web and apps/api.
// These mirror the enums in apps/api/prisma/schema.prisma exactly (docs/07-database-design.md).
// Do not hand-duplicate a type that Prisma already generates for API-internal code —
// this package exists specifically for the types the *frontend* needs, which can't
// import Prisma's generated client directly.

export type Role =
  | "SUPER_ADMIN"
  | "AGENCY_ADMIN"
  | "HOTEL_ADMIN"
  | "MARKETING"
  | "RESERVATIONS"
  | "VIEWER";

export type TonePreset =
  | "CLASSIC_LUXURY"
  | "MODERN_LUXURY"
  | "BOUTIQUE"
  | "FAMILY_FRIENDLY";

// Lowercase — matches the Prisma enum's deliberate exception (schema.prisma comment),
// the wire/prompt-facing form used in ABS §16, Playbook §2, API §2.1, AI Engine §2.
export type JourneyState =
  | "information"
  | "planning"
  | "booking_intent"
  | "service_recovery";

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

// Playbook §6 — a second, complementary axis to JourneyState: where the guest
// sits in the overall arc of THIS TRIP (can span the whole conversation),
// not what this one message needs right now. Drives the `cta` event's
// lifecycle-stage logic (UX §6) — inferred from explicit language ("we
// already booked", "we're checking in today") per the classifier prompt,
// same as any other detectedSignal; "researching" is the neutral default
// when nothing explicit has been said either way.
export type LifecycleStage =
  | "dreaming"
  | "researching"
  | "comparing"
  | "booking"
  | "preparing"
  | "staying";

export type Domain =
  | "accommodation"
  | "booking"
  | "dining"
  | "spa"
  | "property"
  | "local_area"
  | "policies"
  | "events";

export type Persona =
  | "luxury_traveler"
  | "family_traveler"
  | "business_traveler"
  | "wedding_planner"
  | "event_organizer";

export type DocumentStatus = "PARSING" | "NEEDS_REVIEW" | "FAILED" | "INDEXED";

export type DocumentSourceType = "PDF" | "DOCX" | "TEXT" | "URL";

export type IngestionStage =
  | "PARSING"
  | "EXTRACTING"
  | "CHUNKING"
  | "TAGGING"
  | "EMBEDDING"
  | "VALIDATING";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type Priority = "HIGH" | "NORMAL" | "LOW";

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";

export type EntityType =
  | "ROOM_TYPE"
  | "PACKAGE"
  | "RESTAURANT"
  | "SPA_TREATMENT"
  | "AMENITY"
  | "POLICY"
  | "LOCAL_RECOMMENDATION"
  | "EVENT_SPACE"
  | "EXPERIENCE"
  | "PROPERTY_PROFILE";

// ---------------------------------------------------------------------------
// API §2.4 — GET /v1/chat/bootstrap. Everything the widget needs to render the
// launcher and opening state in one round trip. Produced by apps/api, consumed
// by packages/sdk — this shared package is the single source for the contract.
// ---------------------------------------------------------------------------

export interface BootstrapResponse {
  hotel: { name: string; conciergeName: string };
  brand: {
    tonePreset: string;
    primaryColor: string;
    fontFamily: string;
    logoUrl: string;
  };
  greeting: string;
  suggestedQuestions: string[];
  quickStart: Array<{ label: string; contextTag: string }>;
  launcherDelayMs: number;
}

// ---------------------------------------------------------------------------
// API §2.1 — the SSE event union. This is the contract the widget renders
// against — the widget never infers behavior, it only renders these events.
// ---------------------------------------------------------------------------

export interface ChatAckEvent {
  type: "ack";
  conversationId: string;
}

export interface ChatDeltaEvent {
  type: "delta";
  text: string;
}

export interface RecommendationCard {
  entityType: EntityType;
  entityId: string;
  title: string;
  hook: string;
  imageUrl?: string;
  linkUrl?: string;
}

export interface ChatCardEvent {
  type: "card";
  cards: RecommendationCard[];
}

export type LeadField = "email" | "dates" | "name" | "phone";

export interface ChatLeadPromptEvent {
  type: "lead_prompt";
  promptId: string;
  question: string;
  field: LeadField;
}

export interface ChatEscalationEvent {
  type: "escalation";
  escalationId: string;
  reason: string;
  options: Array<"connect_now" | "contact_me">;
  liveStaffAvailable: boolean;
}

export type CtaKind = "book_now" | "explore_rooms" | "plan_my_stay" | "request_assistance";

export interface ChatCtaEvent {
  type: "cta";
  kind: CtaKind;
  url: string;
}

export interface ChatDoneEvent {
  type: "done";
  messageId: string;
  journeyState: JourneyState;
  confidenceBand: ConfidenceBand;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface ChatErrorEvent extends ApiErrorPayload {
  type: "error";
}

export type ChatSSEEvent =
  | ChatAckEvent
  | ChatDeltaEvent
  | ChatCardEvent
  | ChatLeadPromptEvent
  | ChatEscalationEvent
  | ChatCtaEvent
  | ChatDoneEvent
  | ChatErrorEvent;

// ---------------------------------------------------------------------------
// API §2.2 — POST /v1/chat/lead. Submits the guest's answer to a
// `lead_prompt` (or a decline), one field at a time (UX §4). `nextField`
// drives the client's next inline ask without it guessing (API §2.2).
// ---------------------------------------------------------------------------

export interface SubmitLeadAnswerRequest {
  conversationId: string;
  promptId: string;
  field: LeadField;
  value: string | null;
  consent: boolean;
  declined?: boolean;
}

export interface SubmitLeadAnswerResponse {
  leadId: string;
  captured: LeadField[];
  nextField: LeadField | null;
}

// ---------------------------------------------------------------------------
// API §2.3 — POST /v1/chat/escalation/choose. Submits the guest's answer to
// an `escalation` event's handoff panel (UX §5). `connect_now` is part of
// the wire contract (ABS §7's two standard paths) but is rejected server-side
// in V1 — no live-staff channel exists yet (`ChatEscalationEvent.
// liveStaffAvailable` is always `false`), so it's never actually offered.
// ---------------------------------------------------------------------------

export interface SubmitEscalationChoiceRequest {
  escalationId: string;
  choice: "connect_now" | "contact_me";
  contact?: { name?: string; email?: string; phone?: string } | null;
}

export interface SubmitEscalationChoiceResponse {
  message: string;
}

// ---------------------------------------------------------------------------
// AI Engine §2 — the classifier call's structured output.
// ---------------------------------------------------------------------------

export interface ClassifierOutput {
  journeyState: JourneyState;
  domain: Domain[];
  persona: Persona | null;
  rewrittenQuery: string;
  detectedSignals: {
    occasion: string | null;
    leadCaptureWorthy: boolean;
    /** ABS §7's "explicit request" escalation trigger ("can I talk to a
     * person") — distinct from `journeyState: "service_recovery"`, which
     * already covers complaints/safety/legal/in-house-issue language on its
     * own. A guest can ask for a human in any journey state. */
    explicitHandoffRequest: boolean;
    /** Playbook §6's Trip Lifecycle Stage — independent of `journeyState`. */
    lifecycleStage: LifecycleStage;
    /** ABS §7's "group/event size threshold" escalation trigger — a stated
     * guest/attendee count for a potential group, wedding, or event booking
     * (e.g. "120 guests"). Null unless the guest is describing party size in
     * that specific context — never populated for an ordinary party-size
     * mention (a dinner table, a family room) unrelated to a group/event
     * inquiry. The threshold itself is per-hotel (`BrandSettings.
     * groupInquiryThreshold`), not something the classifier decides. */
    groupSize: number | null;
    /** ABS §10's refusal categories that never benefit from retrieval —
     * competitor comparisons, general off-topic requests, prompt-extraction
     * attempts, medical/legal/financial advice-seeking, and harassment. When
     * true, the pipeline runs generation unconditionally (bypassing the
     * confidence gate — findings-log.md #11), trusting base.md's refusal
     * instructions to handle it, rather than falling back to the generic
     * "I don't have that information" text for what isn't actually a
     * knowledge-base gap. Deliberately excludes policy-override/discount
     * requests — ABS §10 says those should still check for a real current
     * promotion in the knowledge base, so they stay on the normal
     * confidence-gated path. */
    offTopicOrRefusal: boolean;
  };
}

// ---------------------------------------------------------------------------
// API §3.1 — GET /v1/admin/session. What the admin frontend calls once after
// Supabase Auth hands it a JWT, to know which hotel(s)/org(s) and roles it has.
// ---------------------------------------------------------------------------

export interface AdminSessionResponse {
  user: { id: string; email: string; name: string | null };
  organizationMemberships: Array<{
    id: string;
    organizationId: string;
    role: Role;
    organization: { id: string; name: string };
  }>;
  hotelMemberships: Array<{
    id: string;
    hotelId: string;
    role: Role;
    hotel: { id: string; name: string; slug: string } | null;
  }>;
}

// ---------------------------------------------------------------------------
// API §3.2 — Knowledge upload & validation (UX §9). A document uploaded
// through the admin screen ends up as retrievable, tagged chunks; these
// shapes are what that screen polls and renders while that happens.
// ---------------------------------------------------------------------------

/** Cursor-paginated list envelope (API §1 conventions) — used everywhere a
 * knowledge list response is paginated, never offset-based. */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface KnowledgeDocumentSummary {
  id: string;
  filename: string;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  status: DocumentStatus;
  /** Human-readable findings, e.g. "Room Type 'Ocean Suite' is missing
   * capacity." Read-only for now — see docs/14-sprint-backlog.md for why the
   * guided pre-filled edit form isn't built yet. */
  validationIssues: string[];
  uploadedAt: string;
  lastSyncedAt: string | null;
}

export interface KnowledgeDocumentStageStatus {
  documentStatus: DocumentStatus;
  stages: Array<{
    stage: IngestionStage;
    status: JobStatus;
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

export interface KnowledgeChunkPreview {
  id: string;
  content: string;
  domainTags: string[];
  priority: Priority;
  tokenCount: number | null;
}

export interface CreateKnowledgeDocumentResponse {
  documentId: string;
  jobId: string;
}

// ---------------------------------------------------------------------------
// API §3.3 — Structured Entities. Nine real relational tables (DB §6), one
// per type, kept typed rather than one polymorphic JSON blob so the
// Recommendation Engine can filter on capacity/price/duration directly.
// Response shapes mirror the Prisma models exactly (API §3.3: "Shapes =
// Prisma models") — Decimal fields serialize as strings (Prisma's Decimal
// JSON representation), DateTime fields as ISO strings, matching the
// convention already used for Knowledge shapes above. `PropertyProfile` is
// excluded — DB §6 documents it separately as a hotel-wide singleton, not one
// of "the nine", with no CRUD endpoint shape defined yet.
// ---------------------------------------------------------------------------

export interface RoomTypeEntity {
  id: string;
  hotelId: string;
  name: string;
  view: string | null;
  capacity: number;
  bedConfig: string | null;
  accessible: boolean;
  baseRateLow: string | null;
  baseRateHigh: string | null;
  deletedAt: string | null;
}

export interface PackageEntity {
  id: string;
  hotelId: string;
  name: string;
  includedItems: string[];
  validFrom: string | null;
  validTo: string | null;
  priceLow: string | null;
  priceHigh: string | null;
  roomTypeIds: string[];
  deletedAt: string | null;
}

export interface RestaurantEntity {
  id: string;
  hotelId: string;
  name: string;
  cuisine: string | null;
  hours: string | null;
  dressCode: string | null;
  dietaryTags: string[];
  reservationPolicy: string | null;
  deletedAt: string | null;
}

export interface SpaTreatmentEntity {
  id: string;
  hotelId: string;
  name: string;
  durationMins: number | null;
  price: string | null;
  facility: string | null;
  deletedAt: string | null;
}

export interface AmenityEntity {
  id: string;
  hotelId: string;
  name: string;
  hours: string | null;
  location: string | null;
  accessRule: string | null;
  deletedAt: string | null;
}

export interface PolicyEntity {
  id: string;
  hotelId: string;
  topic: string;
  ruleText: string;
  exceptions: string | null;
  deletedAt: string | null;
}

export interface LocalRecommendationEntity {
  id: string;
  hotelId: string;
  name: string;
  category: string | null;
  distanceNote: string | null;
  curationNote: string | null;
  deletedAt: string | null;
}

export interface EventSpaceEntity {
  id: string;
  hotelId: string;
  name: string;
  capacity: number | null;
  layoutOptions: string[];
  avEquipment: string[];
  cateringMinimum: string | null;
  deletedAt: string | null;
}

export interface ExperienceEntity {
  id: string;
  hotelId: string;
  name: string;
  category: string | null;
  durationMins: number | null;
  price: string | null;
  bookingLeadHrs: number | null;
  ageRestriction: string | null;
  deletedAt: string | null;
}

/** Maps the kebab-case route param API §3.3 uses for `:type` to its entity shape. */
export interface EntityByParam {
  'room-types': RoomTypeEntity;
  packages: PackageEntity;
  restaurants: RestaurantEntity;
  'spa-treatments': SpaTreatmentEntity;
  amenities: AmenityEntity;
  policies: PolicyEntity;
  'local-recommendations': LocalRecommendationEntity;
  'event-spaces': EventSpaceEntity;
  experiences: ExperienceEntity;
}

export type EntityParam = keyof EntityByParam;

/** `GET /v1/admin/entities/search` result row — typeahead for the bundle builder (UX §10). */
export interface EntitySearchResult {
  id: string;
  entityType: EntityType;
  name: string;
}

// ---------------------------------------------------------------------------
// API §3.3 — Relationship Bundles (IA §12, UX §10). `EntityRelationship` is a
// curated, directed edge between two entities — no FK on `fromEntityId`/
// `toEntityId` in the schema (polymorphic, validated app-side), no soft
// delete (a real hard delete). `relationshipType`/`contextTag` are both
// free-text `String` columns, not closed enums — the docs only ever give
// example values ("pairs_with"/"suitable_for"/"near",
// "anniversary"/"family"/"honeymoon"), never an exhaustive list.
// ---------------------------------------------------------------------------

export interface EntityRelationship {
  id: string;
  fromEntityType: EntityType;
  fromEntityId: string;
  toEntityType: EntityType;
  toEntityId: string;
  relationshipType: string;
  contextTag: string;
  priority: Priority;
}

/** Body for `POST /v1/admin/relationships`. */
export interface CreateRelationshipRequest {
  fromEntityType: EntityType;
  fromEntityId: string;
  toEntityType: EntityType;
  toEntityId: string;
  relationshipType: string;
  contextTag: string;
  priority?: Priority;
}

/** `POST /v1/admin/relationships/preview` response — exactly the `card` SSE
 * event payload a guest mentioning this `contextTag` would receive (API
 * §2.1/§3.3's "one implementation, no drift"). */
export interface PreviewBundleResponse {
  type: "card";
  cards: RecommendationCard[];
}

// ---------------------------------------------------------------------------
// API §3.6 — Analytics. `GET /v1/admin/analytics/daily` reads `DailyMetric`
// rollups (DB §13) — never live aggregates. Powers the Dashboard's KPI tiles
// (UX §8). `avgSatisfaction` stays `null` for every row today — no guest-
// facing satisfaction-capture flow exists anywhere in the product yet
// (findings-log.md #12).
// ---------------------------------------------------------------------------

export interface DailyMetricRow {
  date: string;
  messageCount: number;
  conversationCount: number;
  bookingIntentCount: number;
  leadCount: number;
  escalationCount: number;
  avgSatisfaction: number | null;
}

/** `GET /v1/admin/analytics/topics` (UX §12 "Guests Ask Most About") — the
 * `domainTags` distribution of real conversations. `domain` is the real IA §2
 * taxonomy (8 fixed values), not the finer-grained topic names UX §12's own
 * mockup shows ("Airport Transfer," "Pet Policy") — nothing in the pipeline
 * extracts anything finer than the classifier's own `domain` output
 * (findings-log.md #20). Sorted descending by `count`. */
export interface TopicDistributionRow {
  domain: Domain;
  count: number;
}

/** `GET /v1/admin/analytics/gaps` (UX §12 "Missing Information") — domains
 * with repeated LOW-confidence turns in the queried window (default: trailing
 * 7 days), each with a plain per-domain `recommendedAction` phrase (not
 * content-aware — findings-log.md #20). Only domains at/above the "repeated"
 * threshold (2) are included. Sorted descending by `lowConfidenceCount`. */
export interface MissingInformationGap {
  domain: Domain;
  lowConfidenceCount: number;
  recommendedAction: string;
}

// ---------------------------------------------------------------------------
// API §3.4 — Conversations & QA. `GET /v1/admin/conversations` (triage list,
// UX §11), `GET .../:id` (full thread), `POST`/`PATCH .../qa-score` (the ABS
// §15 rubric — grounding/tone/escalation/leadCapture/resolution, 1–5 each),
// `POST .../flag-for-playbook` (closes the Playbook §7 loop).
// ---------------------------------------------------------------------------

export type ConversationStatus = "ACTIVE" | "ESCALATED" | "CLOSED";

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  startedAt: string;
  endedAt: string | null;
  journeyState: JourneyState | null;
  domainTags: string[];
  escalated: boolean;
  hasLead: boolean;
  leadScore: number | null;
  messageCount: number;
}

export interface MessageDetail {
  id: string;
  role: "GUEST" | "CONCIERGE";
  content: string;
  journeyState: JourneyState | null;
  confidenceBand: ConfidenceBand | null;
  escalationTriggered: boolean;
  leadCaptureTriggered: boolean;
  domainTags: string[];
  createdAt: string;
}

export interface QAScoreDetail {
  id: string;
  grounding: number;
  tone: number;
  escalation: number;
  leadCapture: number;
  resolution: number;
  scoredBy: string;
  scoredAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: MessageDetail[];
  qaScore: QAScoreDetail | null;
}

/** Body for `POST`/`PATCH /v1/admin/conversations/:id/qa-score` — each
 * dimension 1–5 per ABS §15's rubric. */
export interface QAScoreInput {
  grounding: number;
  tone: number;
  escalation: number;
  leadCapture: number;
  resolution: number;
}

/** Body for `POST /v1/admin/conversations/:id/flag-for-playbook`. `messageId`
 * picks which GUEST message becomes the scenario's `guestMessage` — defaults
 * to the conversation's first guest message when omitted. The rest mirrors
 * `PlaybookScenario`'s own qualitative fields, which nothing can infer
 * automatically from a transcript. */
export interface FlagForPlaybookRequest {
  messageId?: string;
  expectedBehavior?: string[];
  mustNot?: string[];
  escalationExpected?: boolean;
  leadCaptureExpected?: boolean;
}

export interface FlagForPlaybookResponse {
  scenarioId: string;
}

// ---------------------------------------------------------------------------
// API §3.4 — Leads inbox. `GET/PATCH /v1/admin/leads[/:id]` (filter by
// `status`, update status/owner/notes), `POST /v1/admin/leads` (manual entry
// — a phone or walk-in inquiry). `source` isn't a stored column (findings-log
// .md #15) — derived from `conversationId` being null (a manually-entered
// lead has no chat conversation behind it; every chat-captured lead always
// has one).
// ---------------------------------------------------------------------------

export type LeadSource = "chat" | "manual";

export interface LeadSummary {
  id: string;
  status: LeadStatus;
  source: LeadSource;
  conversationId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  travelDates: string | null;
  budget: string | null;
  guestCount: number | null;
  reasonForStay: string | null;
  preferredRoom: string | null;
  consentGiven: boolean;
  leadScore: number | null;
  assignedOwnerId: string | null;
  notes: string | null;
  createdAt: string;
}

/** Body for `PATCH /v1/admin/leads/:id` — every field optional, only
 * status/owner/notes are ever updated here (contact/trip details come from
 * the guest via the chat flow or manual entry, not admin edits). */
export interface UpdateLeadRequest {
  status?: LeadStatus;
  assignedOwnerId?: string | null;
  notes?: string | null;
}

/** Body for `POST /v1/admin/leads` — manual entry (API §3.4). At least one of
 * `name`/`email`/`phone` is required; there's no point logging a lead with no
 * way to reach the guest. */
export interface CreateManualLeadRequest {
  name?: string;
  email?: string;
  phone?: string;
  travelDates?: string;
  budget?: string;
  guestCount?: number;
  reasonForStay?: string;
  preferredRoom?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// API §3.5 — Brand Settings. `GET/PATCH /v1/admin/brand`, mirroring
// `BrandSettings` (DB §"Brand & Prompts"). PATCH validates WCAG AA contrast
// before saving (UI Design System §10) — see findings-log.md #17 for exactly
// which color pairs get checked and why. `formalityNote`/`emojiAllowed`/
// `signOff`/`secondaryColor` are editable here but not yet consumed by any
// guest-facing behavior (findings-log.md #18, deliberately deferred).
// ---------------------------------------------------------------------------

export interface BrandSettingsResponse {
  conciergeName: string;
  tonePreset: TonePreset;
  formalityNote: string | null;
  emojiAllowed: boolean;
  signOff: string | null;
  greeting: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  bookingEngineUrl: string | null;
  groupInquiryThreshold: number;
  /** `null` when the hotel has no `BrandSettings` row yet — every other
   * field above is still a real, usable default in that case (API §1's
   * general "never a silent surprise" shape), just not yet saved. */
  updatedAt: string | null;
}

/** Body for `PATCH /v1/admin/brand` — every field optional (a partial
 * update), same convention as `UpdateLeadRequest`. */
export interface UpdateBrandSettingsRequest {
  conciergeName?: string;
  tonePreset?: TonePreset;
  formalityNote?: string | null;
  emojiAllowed?: boolean;
  signOff?: string | null;
  greeting?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  bookingEngineUrl?: string | null;
  groupInquiryThreshold?: number;
}

/** One failing pair in a `422 CONTRAST_FAILURE` response body — named
 * explicitly per API §3.5's "the failing combination named, not a silent
 * save." */
export interface ContrastFailureDetail {
  field: "primaryColor" | "secondaryColor";
  color: string;
  against: string;
  ratio: number;
  required: number;
}

// ---------------------------------------------------------------------------
// API §3.7 — Notifications. `GET /v1/admin/notifications` (filter by
// `status`, cursor-paginated, scoped to the calling admin's own
// `recipientId`), `PATCH /v1/admin/notifications/:id/read`. One row per
// `HotelMembership` per triggering event — no broadcast/role-filter concept
// in the schema (findings-log.md #21). `status` only ever moves
// `PENDING` → `READ` today; `SENT`/`FAILED` imply an outbound delivery
// channel (email/push) that doesn't exist yet.
// ---------------------------------------------------------------------------

export type NotificationType =
  | "NEW_LEAD"
  | "ESCALATION"
  | "INGESTION_FAILED"
  | "SYSTEM_ERROR"
  | "WEEKLY_REPORT";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "READ";

export interface NotificationSummary {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  createdAt: string;
}

/** `NotificationSummary.payload` shape when `type === "NEW_LEAD"`. */
export interface NewLeadNotificationPayload {
  leadId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/** `NotificationSummary.payload` shape when `type === "ESCALATION"`. */
export interface EscalationNotificationPayload {
  escalationId: string;
  conversationId: string;
  reason: string;
}

/** `NotificationSummary.payload` shape when `type === "INGESTION_FAILED"` —
 * fires only on `Document.status === "FAILED"`, never `"NEEDS_REVIEW"`
 * (findings-log.md #21). */
export interface IngestionFailedNotificationPayload {
  documentId: string;
  filename: string;
}
