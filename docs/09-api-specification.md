# API Specification

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [System Architecture](06-system-architecture.md) · [Database Design](07-database-design.md) · [UX Flows](05-user-experience-flows.md) · [AI Behavior Specification](02-ai-behavior-specification.md)

The Architecture doc named the boundaries; the DB doc defined what's stored. This document pins the contracts between them — every endpoint, its auth, its shapes, and (most importantly) the streaming protocol that carries the concierge's behavior to the widget. This is the last document Claude Code needs open while implementing; ambiguity here becomes a bug there.

---

## 1. Conventions

- **Base path:** `/v1/...` — versioned from day one; `v1` is cheap now and impossible to retrofit gracefully later.
- **Two API surfaces**, per [Architecture §3](06-system-architecture.md):
  - **Guest API** (`/v1/chat/*`) — public, scoped by widget key, rate-limited.
  - **Admin API** (`/v1/admin/*`) — Supabase Auth JWT, role-gated per [PRD §16](01-PRD-ai-concierge.md).
- **Tenant resolution** is never client-supplied. Guest API: `X-Widget-Key` header → `hotel_id` lookup ([DB `WidgetKey`](07-database-design.md)). Admin API: JWT → memberships → allowed hotel(s); multi-hotel admins pass `hotelId` as a query param, validated against membership. Either way, the resolved `hotel_id` is what sets the RLS session variable ([DB §9](07-database-design.md)).
- **Error envelope**, uniform everywhere:

```json
{ "error": { "code": "KNOWLEDGE_EMPTY", "message": "This hotel has no indexed content yet.", "requestId": "req_..." } }
```

`code` is a stable machine string (never parse `message`); `requestId` correlates with logs/Sentry. HTTP status carries the class (400/401/403/404/409/422/429/500).

**Successful responses are not wrapped in `{ "success": true, "data": {...} }`.** The resource is returned directly at the top level, and HTTP status already carries success/failure — a `success` field on every 2xx response would be redundant with the status code and adds a nesting level every client has to unwrap for no benefit. (Considered and deliberately not adopted — it's a defensible alternative convention, just not this one.)

- **Pagination:** cursor-based — `?cursor=<opaque>&limit=50` in, `{ items: [...], nextCursor: string | null }` out. Offset pagination is not used anywhere (it degrades on exactly the tables that grow: messages, conversations, leads).
- **IDs** are the DB's cuids, passed verbatim. **Timestamps** are ISO-8601 UTC.
- **Naming:** camelCase JSON keys, matching the Prisma schema field names 1:1 — no translation layer to keep in sync.

## 2. Guest API

### 2.1 `POST /v1/chat/message` — the product

**Headers:** `X-Widget-Key: wk_...` · **Rate limit:** per key + per session (429 with `Retry-After` on breach).

**Request:**

```json
{
  "sessionId": "sess_...",          // client-generated, stable for the browser session (ABS §11)
  "conversationId": "c_... | null", // null on first message → server creates and returns one
  "message": "We're celebrating our anniversary.",
  "contextTag": "romantic_escape | null"  // set when the guest tapped the quick-start selector (UX §2)
}
```

**Response: `text/event-stream`.** This SSE protocol is the single most important contract in the system — it's how every behavior the ABS specifies actually reaches the widget. The server drives; the widget renders. The widget never infers behavior (never decides on its own to show a lead prompt or a handoff panel); it renders the events it's sent. That keeps the entire ABS enforceable server-side, testable by the [Playbook](04-conversation-playbook.md), and consistent across every hotel.

| Event | Payload | Purpose |
|---|---|---|
| `ack` | `{ "conversationId": "c_..." }` | Sent immediately (≤300ms) — the widget's acknowledgment cue (and Option D's "Approach", if that layer is adopted). Satisfies the <2s NFR regardless of generation latency. |
| `delta` | `{ "text": "Congratulations. For the " }` | Streamed response text, appended in order. |
| `card` | `{ "cards": [{ "entityType": "ROOM_TYPE", "entityId": "rt_...", "title": "Ocean View Suite", "hook": "Private balcony · sea views", "imageUrl": "...", "linkUrl": "..." }] }` | Recommendation card(s) ([UX §3](05-user-experience-flows.md)) — 1 card normally, 2–3 for a relationship bundle. At most one `card` event per turn ([ABS §9](02-ai-behavior-specification.md)). |
| `lead_prompt` | `{ "promptId": "lp_...", "question": "Would you like me to email you the details?", "field": "email \| dates \| name \| phone" }` | The Yes/No + one-field lead-capture step ([UX §4](05-user-experience-flows.md)). Server-initiated only — fired when an [ABS §8](02-ai-behavior-specification.md) signal is detected, never by the client. |
| `escalation` | `{ "escalationId": "e_...", "reason": "service_recovery", "options": ["connect_now", "contact_me"], "liveStaffAvailable": false }` | Renders the handoff panel ([UX §5](05-user-experience-flows.md)). When `reason` is `service_recovery`, the widget must suppress cards/chips for the rest of the conversation. |
| `cta` | `{ "kind": "book_now \| explore_rooms \| plan_my_stay \| request_assistance", "url": "..." }` | Lifecycle-stage-appropriate CTA ([UX §6](05-user-experience-flows.md)) — server-decided, so "Book Now" can never appear to an already-booked guest by client accident. |
| `done` | `{ "messageId": "m_...", "journeyState": "planning", "confidenceBand": "HIGH" }` | Turn complete. Metadata is for client analytics beacons only — never rendered to the guest ([ABS §5](02-ai-behavior-specification.md): confidence is admin-facing). |
| `error` | Standard error envelope | Mid-stream failure → widget shows the graceful fallback ([UX §13](05-user-experience-flows.md)) and offers handoff. |

**Event ordering guarantee:** `ack` first; `delta`s contiguous; `card`/`lead_prompt`/`escalation`/`cta` only after the final `delta` (the answer always completes before any side action — [ABS §18](02-ai-behavior-specification.md)'s answer-first rule, enforced at the protocol level); `done` or `error` last, exactly once.

### 2.2 `POST /v1/chat/lead`

Submits the guest's answer to a `lead_prompt` (or the handoff contact capture). **Idempotent** via `Idempotency-Key: <promptId>` header — a double-tap on "Yes" creates one lead, not two.

```json
// request
{ "conversationId": "c_...", "promptId": "lp_...", "field": "email", "value": "guest@example.com", "consent": true }
// response 201
{ "leadId": "l_...", "captured": ["email"], "nextField": "dates | null" }
```

`nextField` lets the server continue the one-field-at-a-time flow without the client guessing. Declines are also posted (`"value": null, "declined": true`) so the server knows not to re-ask ([ABS §8](02-ai-behavior-specification.md)).

### 2.3 `POST /v1/chat/escalation/choose`

```json
{ "escalationId": "e_...", "choice": "contact_me", "contact": { "email": "..." } }
```

Attaches transcript + detected intent to the escalation record automatically ([ABS §7](02-ai-behavior-specification.md)) — the guest never re-explains. Returns `202` with a confirmation message string to render.

### 2.4 `GET /v1/chat/bootstrap`

Called once when the widget loads. Returns everything needed to render the launcher and opening state with **zero** further calls: brand tokens ([UI Design System §1](08-ui-design-system.md)), greeting, suggested-question chips, quick-start selector options, and the launcher delay. One round trip, cacheable (`Cache-Control: public, max-age=300`), because widget load time is hotel-website page-weight — this endpoint is why embedding the concierge doesn't slow the site.

```json
{
  "hotel": { "name": "Bellevue Hotel", "conciergeName": "The Bellevue Concierge" },
  "brand": { "tonePreset": "CLASSIC_LUXURY", "primaryColor": "#2F4A3C", "fontFamily": "...", "logoUrl": "..." },
  "greeting": "Welcome to Bellevue Hotel...",
  "suggestedQuestions": ["Which room is best for families?", "..."],
  "quickStart": [{ "label": "Romantic Escape", "contextTag": "romantic_escape" }],
  "launcherDelayMs": 6000
}
```

### 2.5 `GET /v1/chat/history/:conversationId`

Rehydrates a widget that reloads mid-session — [UX §2](05-user-experience-flows.md)'s "reopening resumes, doesn't restart" needed a concrete endpoint behind it, and didn't have one. Scoped by `X-Widget-Key` **and** `sessionId` together (not just the conversation id) — a conversation id alone must never be enough to read someone else's transcript. Returns the message list in the same shapes §2.1's events already use, so the widget's rendering code for "replay history on load" and "render a live stream" is the same code path, not two.

## 3. Admin API

All routes require `Authorization: Bearer <jwt>`; role requirements per route follow [PRD §16](01-PRD-ai-concierge.md) (VIEWER read-only; MARKETING no lead reassignment; only HOTEL_ADMIN+ touch brand/prompt/knowledge; AGENCY_ADMIN spans hotels). Standard CRUD is listed compactly — shapes mirror the [Prisma models](07-database-design.md) exactly; only non-obvious contracts get detail.

### 3.1 Session & Hotels

| Method & path | Notes |
|---|---|
| `GET /v1/admin/session` | Returns the authenticated user + their `OrganizationMembership`/`HotelMembership` rows and roles ([DB §3](07-database-design.md)) — what the frontend calls once after Supabase Auth hands it a JWT, to know which hotel(s) and permissions it's working with. |
| `GET /v1/admin/hotels` | Hotels visible to the caller — one row for a Hotel Admin, the portfolio for an Agency Admin. |
| `GET /v1/admin/hotels/:id` · `PATCH /v1/admin/hotels/:id` | Hotel profile (name, slug, timezone, etc.). |
| `POST /v1/admin/hotels` | AGENCY_ADMIN only — onboards a new hotel into the org. |

**No `/auth/login` or `/auth/logout` endpoints exist here, deliberately.** Credential issuance is Supabase Auth's job end to end — the frontend authenticates directly against Supabase (email/password, magic link, or OAuth) and gets a Supabase-issued JWT without our API ever seeing a password. Our API's only role is validating that JWT and answering "given this authenticated user, what are they allowed to see" (`/session` above) — minting our own access/refresh token pair would recreate exactly the credential-handling liability [Database Design §1](07-database-design.md) already deliberately outsourced.

### 3.2 Knowledge

| Method & path | Notes |
|---|---|
| `POST /v1/admin/knowledge/documents` | Multipart upload **or** `{ "sourceUrl": "..." }` for URL sync. Returns `202 { documentId, jobId }` immediately — processing is async ([Architecture §5](06-system-architecture.md)). |
| `GET /v1/admin/knowledge/documents?status=NEEDS_REVIEW` | List with status filter; powers the upload screen's badges ([UX §9](05-user-experience-flows.md)). |
| `GET /v1/admin/knowledge/documents/:id/status` | Per-stage pipeline status from `IngestionJob` rows — `{ stage: "EMBEDDING", status: "RUNNING", ... }` → the UI's plain-language labels ("Reading… Chunking… Embedding…"). Polled at 2s during active processing. |
| `GET /v1/admin/knowledge/documents/:id/chunks` | Chunk preview — content + domainTags + priority, paginated. Never returns embeddings (useless to the UI, large on the wire). |
| `PATCH /v1/admin/knowledge/documents/:id/review` | Submits the guided "Needs Review" form (missing entity fields) → revalidates → `INDEXED`. |
| `DELETE /v1/admin/knowledge/documents/:id` | Soft delete ([DB §1](07-database-design.md)); chunks drop out of retrieval immediately. |
| `POST /v1/admin/knowledge/reindex` | Bulk re-enqueue for the hotel — same pipeline, batch mode. |

### 3.3 Entities & Relationship Bundles

| Method & path | Notes |
|---|---|
| `GET/POST/PATCH/DELETE /v1/admin/entities/:type[/:id]` | One uniform CRUD surface for all nine entity types; `:type` is the [DB `EntityType`](07-database-design.md) enum, lowercased (`room-types`, `spa-treatments`, ...). Shapes = Prisma models. |
| `GET /v1/admin/entities/search?q=ocean&types=ROOM_TYPE,SPA_TREATMENT` | Typeahead for the bundle builder ([UX §10](05-user-experience-flows.md)). |
| `GET/POST/DELETE /v1/admin/relationships[/:id]` | `EntityRelationship` CRUD, filterable by `contextTag`. |
| `POST /v1/admin/relationships/preview` | `{ "contextTag": "anniversary" }` → the exact `card` event payload the guest would receive (§2.1). The bundle builder's live preview renders real guest-facing cards because it literally calls the same card-assembly code — one implementation, no drift. |

### 3.4 Conversations, Leads, QA

| Method & path | Notes |
|---|---|
| `GET /v1/admin/conversations` | Filters: `escalated`, `hasLead`, `journeyState`, date range. Rows include domain tags + lead score for triage ([UX §11](05-user-experience-flows.md)). |
| `GET /v1/admin/conversations/:id` | Full thread — messages with their per-turn `journeyState`, `confidenceBand`, flags ([DB `Message`](07-database-design.md)). |
| `POST /v1/admin/conversations/:id/qa-score` | `{ grounding, tone, escalation, leadCapture, resolution }` (1–5 each) → `QAScore`. One per conversation (409 on duplicate; PATCH to revise). |
| `POST /v1/admin/conversations/:id/flag-for-playbook` | Creates a `PlaybookScenario` from the transcript ([Playbook §7](04-conversation-playbook.md) loop). Body may pre-fill `expectedBehavior`/`mustNot`. |
| `GET/PATCH /v1/admin/leads[/:id]` | Inbox list (filter by `status`) + status/owner/notes updates. |
| `POST /v1/admin/leads` | Manual lead entry — a phone or walk-in inquiry a staff member wants logged alongside chat-sourced leads, same `Lead` model, `source: "manual"`. |
| `GET /v1/admin/escalations` | Grouped by structured `reason` for the analytics view. |

### 3.5 Brand, Prompts, Settings

| Method & path | Notes |
|---|---|
| `GET/PATCH /v1/admin/brand` | `BrandSettings`. PATCH validates WCAG AA contrast for the color pair before saving ([UI Design System §10](08-ui-design-system.md)) — `422 CONTRAST_FAILURE` with the failing combination named, not a silent save. Audit-logged. |
| `GET/POST /v1/admin/prompts` · `POST /v1/admin/prompts/:id/activate` | Versioned `PromptOverride` ([DB §4](07-database-design.md)); activate swaps the single `active` flag atomically. Audit-logged. |
| `GET /v1/admin/prompts/rendered` | The fully-assembled system prompt ([ABS §14](02-ai-behavior-specification.md) template + brand + overrides) as the model will actually receive it — read-only, for the Prompt Settings preview. Debugging prompt issues without this endpoint means guessing. |
| `POST /v1/admin/prompts/test` | `{ "promptOverrideId": "po_... \| null", "message": "..." }` → runs one draft or active prompt against a sample guest message and returns what the concierge would say, **without** creating a `Conversation`/`Message` row. This is what lets a draft `PromptOverride` get tried against [Playbook](04-conversation-playbook.md) scenarios before it's ever activated, and what an admin uses to sanity-check a brand-voice edit before it goes live. |
| `GET/PUT /v1/admin/integrations` · `GET /v1/admin/billing` | Stubs backing the nav items ([DB §13](07-database-design.md)) — `Integration` rows render "not connected"; billing reads `Subscription`. |
| `GET/POST/PATCH /v1/admin/users` | Memberships + roles. HOTEL_ADMIN+ only. |
| `POST /v1/admin/widget-keys` · `POST /v1/admin/widget-keys/:id/revoke` | Key lifecycle; revocation is immediate (checked per-request, not cached). |

### 3.6 Analytics

| Method & path | Notes |
|---|---|
| `GET /v1/admin/analytics/daily?from=&to=` | Reads `DailyMetric` rollups ([DB §13](07-database-design.md)) — never live aggregates. Powers KPI tiles. |
| `GET /v1/admin/analytics/topics` | Domain-tag distribution of real conversations — "Guests Ask Most About." |
| `GET /v1/admin/analytics/gaps` | The Missing Information panel ([UX §12](05-user-experience-flows.md)): topics with repeated LOW-confidence turns, each with a `recommendedAction` string ("Upload your spa menu"). The single highest-leverage admin read in the product. |
| `GET /v1/admin/agency/portfolio` | AGENCY_ADMIN only — per-hotel health scores (knowledge completeness + lead rate + volume) with inline reasons ([UX §8](05-user-experience-flows.md)). |

### 3.7 Notifications

| Method & path | Notes |
|---|---|
| `GET /v1/admin/notifications` | Backs the `Notification` model ([DB §13](07-database-design.md)) — new lead, escalation, ingestion failure, weekly report ([PRD §14](01-PRD-ai-concierge.md)). Had a table and no API surface until now. |
| `PATCH /v1/admin/notifications/:id/read` | Marks read. |

## 4. Cross-Cutting Behavior

- **Rate limits:** Guest API `30 msg/session/hour`, `300 req/key/hour` (per [Architecture §10](06-system-architecture.md)); Admin API generous but present. Always `429` + `Retry-After`, never silent drops.
- **Audit logging** ([DB `AuditLog`](07-database-design.md)) is middleware on every mutating `/v1/admin/*` route touching brand, prompts, knowledge, or users — not per-handler code that can be forgotten.
- **CORS:** Guest API allows the hotel's registered domain(s) per widget key — a stolen key pasted into another site gets `403 ORIGIN_MISMATCH`. Admin API is same-origin only.
- **Soft-deleted rows** never appear in any list response; no `includeDeleted` param exists in v1 (restore is a support operation, not a UI feature yet).
- **`GET /v1/health`** — unauthenticated, no tenant resolution, checks DB connectivity only. For uptime monitoring, not a dashboard.
- **NestJS mapping:** each §3 group is one module in the [monolith structure](06-system-architecture.md) — `hotels/` (session, hotel profile, brand, keys, users), `knowledge/`, `conversations/`, `leads/`, `analytics/`, `ai/` (chat pipeline + prompts). The spec's section boundaries *are* the module boundaries, deliberately.

## 5. What This Spec Deliberately Excludes

Per [PRD §19](01-PRD-ai-concierge.md): no booking/transaction endpoints (the `cta` event links out — nothing to POST), no live-chat staff websocket in v1 (`liveStaffAvailable` is `false` until a staff console exists; `contact_me` is the working path), no public API for hotels' own developers (the Guest API is for our widget only — key-scoped, not a platform API yet), no webhooks (V2, alongside CRM integrations).

---

**Next document:** [AI Engine Specification](10-ai-engine-specification.md) — the model-call inventory behind §2.1's streaming events, then the Development Plan.
