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
