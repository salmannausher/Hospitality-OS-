# Sprint Backlog & Development Roadmap

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [Development Plan](11-development-plan.md) and, through it, every prior document

The [Development Plan](11-development-plan.md) explains *why* the six phases are ordered the way they are. This document is the *what* — every phase broken into checkable tickets, so a coding session (yours or Claude Code's) can start from "what's the next unchecked box" instead of re-deriving scope from the phase description each time.

**Why the bare page comes before the homepage, not after.** The obvious-looking order is "build the homepage first, then the widget, then wire the AI in" — it reads as a natural progression. It's backwards: a homepage with no working concierge behind it proves nothing, and building it first means investing visual effort before the actual uncertainty (does retrieval/grounding/confidence-gating work at all?) is resolved. Sprint 1 deliberately proves the hard part against a bare, unstyled page; the real Bellevue homepage doesn't arrive until Sprint 5, once there's working behavior underneath it to skin. The milestone markers below exist specifically so this doesn't feel like "nothing to show" in the meantime — there's a genuine, working proof point by the end of Sprint 2, just not a polished one.

---

## How to Use This

- **Check boxes off as work completes.** This file is meant to be edited, committed, and diffed like code — it's the actual project tracker, not a description of one.
- **Sprints are ordered by dependency, not by a fixed calendar.** "Sprint" here means "the next coherent block of work," not a promised week. Solo-developer-plus-AI-agent velocity is genuinely uncertain in either direction — don't force a ticket into a sprint boundary just because a clock says so.
- **Don't start a sprint's tickets out of order without a reason.** The order encodes real dependencies (e.g., you cannot test lead capture before the chat pipeline exists) — per [Development Plan §2](11-development-plan.md).
- **A sprint isn't "done" until its own Definition of Done line is true**, not just its boxes checked — the boxes are the mechanism, the DoD line is the actual bar.
- **When the [Playbook](04-conversation-playbook.md) catches something**, add a ticket to fix it in the current sprint rather than deferring — per [Development Plan §3](11-development-plan.md), this is how the regression loop is supposed to work in practice, not just in theory.
- **No hour estimates.** A per-ticket hour count is a human-solo-developer labor model, and it doesn't transfer cleanly to AI-assisted implementation — some tasks compress dramatically (boilerplate, CRUD scaffolding), others don't compress at all (waiting on external provisioning, a genuinely novel spike, human review). Each sprint carries a **relative effort tag** (Low/Medium/High) instead — useful for knowing where the risk concentrates, without the false precision of a fake number.

## Per-Ticket Definition of Done

Every box above, regardless of sprint, isn't checked until:

- [ ] Works locally, end to end for that ticket's scope
- [ ] TypeScript has no errors
- [ ] Lint passes (ESLint + Prettier, enforced pre-commit — [Engineering Conventions §8](12-engineering-conventions.md))
- [ ] Mobile layout works, where the ticket touches guest-facing UI ([UX §1](05-user-experience-flows.md))
- [ ] Error, loading, and empty states exist where the ticket touches a screen — the empty-knowledge-base and mid-stream-failure cases in [UX §13](05-user-experience-flows.md) are the concrete examples, not abstractions
- [ ] Manually tested — or, where a [Playbook](04-conversation-playbook.md) scenario exists for that behavior, that scenario run directly

## Sprint 0 — Environment & the Week 0 Spike

**Relative effort:** Low, but blocking — nothing else can start until this is done.

**Definition of done:** a "hello world" NestJS route runs as a single Vercel Function, RLS is proven to actually block a cross-tenant read, and the monorepo is scaffolded — nothing product-shaped yet, on purpose ([Development Plan §1](11-development-plan.md)).

- [x] Provision Supabase project — Postgres with the `pgvector` extension enabled
- [ ] Provision Upstash Redis instance
- [ ] Provision Vercel project (Hobby tier is fine pre-launch — [Architecture §8](06-system-architecture.md)) — Vercel CLI already authenticated locally, not yet linked to an actual project
- [ ] Obtain AI Gateway access and a Voyage AI API key
- [x] **Confirm Voyage AI's actual embedding output dimension** — `voyage-4` (the recommended model, [AI Engine §1](10-ai-engine-specification.md)) defaults to 1024 dimensions, matching `vector(1024)` already in the schema exactly. No change needed. All credentials now in place: Supabase, Upstash, Vercel (both projects linked), AI Gateway, Voyage.
- [x] **Spike:** get NestJS running behind a single Vercel Function — resolved via Vercel's own current docs: zero-config, no custom adapter (Architecture §3, corrected). `apps/api/src/main.ts` already matches the required entrypoint convention exactly. Live deploy test still pending an actual linked Vercel project (see above).
- [x] Scaffold the monorepo: `apps/web` (Next.js 16), `apps/api` (NestJS 11), `packages/{ui,types,prompts,sdk,config}` ([Engineering Conventions §2](12-engineering-conventions.md)) — `pnpm install` clean across all 7 workspace packages
- [x] Prisma schema written in full (`apps/api/prisma/schema.prisma`, transcribed from [DB Design](07-database-design.md)), validated, and **applied to the live Supabase project** — three tracked migrations (`0_init`, `1_rls_policies`, `2_app_role`), `prisma migrate status` clean.
- [x] Adversarial test: two hotels created directly, a session connected as the restricted `app_role` and scoped to Hotel A queried both `Hotel` and `RoomType` — Hotel B's rows were completely absent from both result sets. **PASS.** Discovered along the way that this required a genuinely separate, non-owning Postgres role (`app_role`) — RLS policies alone do nothing against the migration-owning role, since Postgres table owners bypass RLS by default. Documented in [DB §9](07-database-design.md).
- [x] Set up Git workflow — `main`/`develop`/`feature/*`, PR-only merges even solo ([Engineering Conventions §8](12-engineering-conventions.md))
- [x] Configure ESLint + Prettier, Husky pre-commit hook (lint + typecheck), Commitlint ([Engineering Conventions §8](12-engineering-conventions.md))

## Sprint 1 — Core Chat Pipeline + Admin Shell

**Relative effort:** High — this is where the actual technical risk concentrates (retrieval, confidence gating, streaming all get proven for the first time).

**Definition of done:** a real question, asked against hand-entered test content, gets a real grounded answer, streamed, inside the latency budget — no cards, no lead capture, no escalation yet ([Development Plan Phase 1](11-development-plan.md)). Separately: a human can actually log into the admin app and see an empty shell.

**Admin shell (parallel track — built 2026-07-20, once `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` landed):**
- [x] Login page, wired directly to Supabase Auth (email/password) — no custom `/auth/login` endpoint, per [API §3.1](09-api-specification.md)'s explicit decision — `apps/web/src/app/admin/login/page.tsx`
- [x] `GET /v1/admin/session` call on load — maps the Supabase JWT to memberships/roles ([API §3.1](09-api-specification.md)) — `apps/api/src/admin/session.controller.ts`, verified live end to end (real login → real access_token → 200 with correct HOTEL_ADMIN membership + hotel name/slug)
- [x] Protected routes / route guard in the Next.js admin app — `apps/web/src/app/admin/(protected)/layout.tsx`, verified live (unauthenticated `/admin` correctly redirects to `/admin/login`)
- [x] Minimal shell: sidebar nav (labels only, screens land in later sprints) + header — enough to log into and see *something* — same layout file + `(protected)/page.tsx`

**New pieces this required, not in the original docs:**
- `SupabaseAuthGuard` + `SupabaseAuthService` (`apps/api/src/auth/`) — verifies the Bearer JWT via Supabase's own `/auth/v1/user` endpoint (no JWT secret needed). Verified live: valid token → 200, missing/garbage token → 401.
- Migration `5_admin_hotel_resolver` — a second `SECURITY DEFINER` function (same shape as `resolve_widget_key`), because `Hotel` is RLS-scoped but the session endpoint runs with no tenant context yet (an Agency Admin's `HotelMembership` rows legitimately span hotels, and this call is itself what discovers which hotel to scope to). Discovered as a live 500 (`Cannot read properties of null`) before being fixed — `Hotel` joined through a plain Prisma `include` silently returned null under `app_role`.
- `prisma/seed-admin.mjs` — reproducible provisioning script (find-or-create the Supabase Auth test admin, upsert `User` + `HotelMembership`). `User.id` is deliberately the Supabase provider's own id, not a generated cuid ([DB §1](07-database-design.md)).
- `AdminSessionResponse` added to `@hospitality/types`; `getAdminSession` added to `@hospitality/sdk`.

**Admin shell fully verified live end to end (2026-07-21):** real browser login (`admin@bellevue-demo.test`) → Supabase Auth → redirect to `/admin` → sidebar + header render with the real `HOTEL_ADMIN` / Bellevue Hotel data from `GET /v1/admin/session` → sign out correctly redirects back to `/admin/login`. Zero console errors.

**One real bug found and fixed along the way — a genuine `@hospitality/sdk` defect, not just an admin-shell gap.** `baseUrl()` read `NEXT_PUBLIC_API_URL` via an indirect `globalThis.process?.env` access. Next.js's env inlining is a build-time static substitution of the literal `process.env.NEXT_PUBLIC_X` expression — any indirection defeats it silently, with no runtime `process` global in the browser to fall back on, so it always resolved to the hardcoded `DEFAULT_BASE_URL` fallback (`http://localhost:3000`) instead of the real API port. This affected **the guest widget too**, not just the admin shell — it had been silently falling back the whole time; earlier verifications happened to catch it before a stale build cache masked it. Fixed by using the literal `process.env.NEXT_PUBLIC_API_URL` form directly (the one pattern Next.js's inlining actually requires), with a minimal ambient `declare const process` so the browser-facing SDK still needs no `@types/node`. Re-verified live: both the widget and the admin shell now correctly hit the real API port.

**Chat pipeline:** built (2026-07-20), fully verified live with real model output (2026-07-21) — see below.
- [x] Seed one hotel with a handful of hand-entered rows (a few `RoomType`, `Restaurant`, `Policy` records) — not real ingestion yet — `apps/api/prisma/seed.mjs` (Bellevue, widget key `wk_demo_bellevue`, 8 Voyage-embedded chunks)
- [x] `GET /v1/chat/bootstrap` ([API §2.4](09-api-specification.md)) — verified live end to end
- [x] Scaffold `packages/prompts` and wire the **classifier prompt** to the AI Gateway on the small/fast model tier (`anthropic/claude-haiku-4.5`) via `GatewayService` — verified live with real classifier output
- [x] Retrieval query: domain-filtered vector similarity ([IA §7](03-information-architecture.md)) — verified live against seeded vectors (correct top hit, RLS-scoped). Entity joins deferred to Sprint 3 (cards)
- [x] Deterministic rerank formula — `0.65×similarity + 0.20×priority + 0.15×recency` ([AI Engine §4](10-ai-engine-specification.md)) — pure fn in `ai/scoring.ts`, unit-tested
- [x] Confidence formula — `0.5×similarity + 0.3×agreement + 0.2×classifier certainty` ([AI Engine §5](10-ai-engine-specification.md)) — pure fn, unit-tested. **Note:** the classifier's documented output (AI Engine §2) has no certainty field — Sprint 1 uses a documented placeholder (classifier health); proper model-reported certainty is a Sprint 3 follow-up
- [x] Low-Confidence path: route to the honest fallback *without* calling the generation model ([ABS §6](02-ai-behavior-specification.md))
- [x] `POST /v1/chat/message` SSE endpoint — `ack`/`delta`/`done`/`error` events only; `card`/`lead_prompt`/`escalation`/`cta` deferred to Sprint 3 ([API §2.1](09-api-specification.md)) — verified live with real streamed generated answers
- [x] Wire `base.md` + `general.md` module only ([AI Engine §3](10-ai-engine-specification.md)) — domain/persona modules deferred to Sprint 3
- [x] Minimal widget: renders streamed plain text and the `ack` cue in a bare unstyled page (`apps/web/src/app/widget`) — verified in-browser
- [x] Verify the latency budget end to end against real infra — `ack` ≤300ms, first generation token in ~1–1.4s ([AI Engine §6](10-ai-engine-specification.md)). Real numbers from this sandbox (not colocated with Supabase/the Gateway — production on Vercel would be faster): ack best-case 234ms; classifier ~6.7s, first generation token ~3.4s in one live run. Sandbox network path, not a code-path latency issue — the `ack`-before-any-DB-call ordering fix from earlier is what matters architecturally; absolute numbers need re-checking on a real colocated deploy.

**AI Gateway card added 2026-07-21 — fully resolved.** `apps/api/verify-gateway.mjs` passes live (real classifier + streamed generation). Real end-to-end proof: asking the widget "Do you allow pets?" produces an accurate, fully-grounded streamed answer citing the exact $50 fee and 15kg limit from the seed data — the actual Sprint 1 milestone.

> **Real finding, not a bug in the code that was written — a genuine retrieval-accuracy gap surfaced by live testing.** Asking "What time is breakfast served?" produced a fluent but *wrong* "I don't have that information" answer. Root cause: the classifier tagged this message `domain: ["accommodation"]` (should be `dining`/`policies`), and retrieval hard-filters on domain overlap per [IA §7](03-information-architecture.md)'s explicit "mandatory, not optional" design — so the correct breakfast chunk never entered the candidate set. Confidence still computed MEDIUM (not LOW) on whatever *did* get retrieved, so generation ran instead of the safe fallback. The pipeline did exactly what it was built to do; the gap is an imperfect classifier tag combined with a hard filter that has no fallback path. **Deliberately not fixed** — IA §7's hard-filter language is an explicit, documented decision, and changing it (e.g. domain as a rerank boost instead of a hard predicate, or a fallback retry without the filter) is an architecture call worth a real conversation, not a silent patch. Strong candidate for the Sprint 3/6 Playbook to formally catch and for a real design discussion before Sprint 3's card-driven retrieval work.
>
> **Partial fix applied 2026-07-22** (discussed with user first — Option 1 of 3 proposed): `packages/prompts/classifier.md` now explicitly instructs the classifier to tag every domain a query plausibly touches rather than the single best-fit one, with the breakfast case spelled out as an example (dining *and* accommodation). This is a prompt change only — the hard-filter retrieval architecture itself is untouched, so this doesn't fully close the gap for domains the classifier still misses; live re-verification of the specific breakfast query is blocked on the AI Gateway free-tier restriction below. If it resurfaces after that's resolved, the belt-and-suspenders option (retry retrieval without the domain filter on LOW/empty results) is the next step, not the rejected soft-filter/boost option.

## Sprint 2 — Knowledge Ingestion

**Relative effort:** High — second only to Sprint 1; parsing and structured extraction across varied real documents is where the messy edge cases live.

**Definition of done:** a document uploaded through the admin screen ends up as retrievable, correctly-tagged chunks — and the pilot/demo content can start being loaded for real ([Development Plan Phase 2](11-development-plan.md)).

**Ingestion pipeline (built 2026-07-20, extraction verified live with real output 2026-07-21):**
- [x] Ingestion worker: parse → **entity-extraction prompt** ([AI Engine §3](10-ai-engine-specification.md)) → chunk → tag → embed (Voyage) → validate ([IA §5](03-information-architecture.md)) — `apps/api/src/knowledge/` (`ParserService`, `ChunkerService`, `IngestionService`). Full pipeline verified live end to end with the card added: 4 of 7 Bellevue docs reached `INDEXED` via real extraction
- [x] `IngestionJob` per-stage status rows, queryable ([DB §5](07-database-design.md)) — written per stage with status/error/timing; verified live for every stage including real EXTRACTING success
- [x] Bulk reindex ([API §3.2](09-api-specification.md)) — `IngestionService.reindex(hotelId)` (service-level; the HTTP endpoint over it is listed in "Deferred" below — not auth-blocked anymore, just not yet built)
- [x] Convert [docs/16](16-demo-property-content.md)'s Bellevue content into real source files and run them through real ingestion — `apps/api/prisma/content/bellevue/*.md,*.txt` + `prisma/ingest-bellevue.mjs` (idempotent). Verified: chunks written with embeddings + correct priority. **PDF/DOCX parsers wired (pdf-parse/mammoth) but not exercised with binary fixtures this session** — demo content is MD/TXT
- [x] Retrieval now respects document status (IA §9): only INDEXED, non-deleted chunks are eligible — was a Sprint 1 gap; fixed + verified (8 INDEXED retrievable, 6 NEEDS_REVIEW hidden)
- [x] Queue behind an `enqueue/process` interface (Architecture §8) — in-process adapter live; BullMQ+Upstash deferred (needs `UPSTASH_REDIS_URL` TCP, only REST creds present)
- [x] Document storage behind an interface — local-fs adapter live; Supabase Storage deferred (needs Supabase creds)

**Admin knowledge HTTP surface — built and verified live 2026-07-22:**
- [x] `POST /v1/admin/knowledge/documents` — multipart upload **and** `{ "sourceUrl" }` URL sync ([API §3.2](09-api-specification.md)), `GET .../documents` (list + status filter), `GET .../documents/:id/status` (per-stage), `GET .../documents/:id/chunks` (preview) — all behind the new shared `SupabaseAuthGuard` + `HotelScopeGuard` (JWT → membership → authorized `hotelId`, API §1's "multi-hotel admins pass `hotelId` as a query param, validated against membership" — not knowledge-specific, reusable by every future admin route). Storage is still the local-fs dev adapter, not Supabase Storage — that swap is still deferred (unrelated to auth, just not built)
- [x] URL-sync ingestion variant ([IA §4](03-information-architecture.md)) — `IngestionService.ingestUrl` + new `UrlFetcherService` (cheerio-based HTML→text, basic SSRF guard on the hostname). **One-shot fetch-and-extract only** — IA §4's fuller "scheduled re-crawl, diffed against last-indexed version" needs recurring-job infra (`BullMQ`/Upstash still isn't wired to a real queue) and is deliberately not built
- [x] Admin upload screen (`apps/web/.../admin/knowledge/page.tsx`) — status badges, live per-stage "Reading… Chunking… Embedding…" polling (UX §9), chunk preview. Verified live: multipart upload, URL sync, and the 2s status poll all observed working end to end in-browser
- [x] `Document.validationIssues String[]` (new migration `6_document_validation_issues`) — human-readable findings (e.g. "Room Type... is missing capacity", or an extraction failure message) persisted per document instead of only an opaque status flag, so the upload screen can show *why* something is `NEEDS_REVIEW`
- [x] `IngestionJob` rows are now written incrementally (`RUNNING` at stage start, updated at completion) instead of batched after the whole pipeline finishes — required for the status endpoint to show anything meaningful while a document is still processing, not just after the fact

**Deliberately not built — a real schema gap, not surface work (flagged to the user, not silently patched):** the *guided*, pre-filled Needs-Review edit form UX §9 describes needs to trace a validation issue back to the specific entity row it came from, but entity tables (`RoomType`, `Restaurant`, etc.) have no `documentId` link today — only `Chunk` does. Fixing that means a schema migration across all nine entity tables, which is an architecture decision, not a thin wrapper. `validationIssues` is read-only in the meantime — admins can see what's wrong, not yet fix it from a pre-filled form.

**Real extraction results on the Bellevue content (2026-07-21):** 4/7 docs `INDEXED` (`about.txt`, `experiences-and-explore.md`, `weddings-and-events.txt`, `dining.txt`), 2 `NEEDS_REVIEW`, 1 transiently `FAILED`.

- `rooms.md` / `spa.md` → `NEEDS_REVIEW` — genuine content-quality finding, not an infrastructure bug: extraction correctly named every `RoomType`/`SpaTreatment` row from the markdown tables but left every associated column (`capacity`, `view`, `durationMins`, `price`, etc.) null, even though the source table has explicit columns for them. Validation (IA §9) correctly caught this and routed to `NEEDS_REVIEW` rather than silently indexing incomplete data — working exactly as designed. The actual gap is `packages/prompts/entity-extraction.md`'s prompt quality on markdown-table column-mapping — deliberately not tuned this session; prompt changes go through the registry's draft→test→activate discipline, not an ad hoc patch.
- `policies.md` → `FAILED` on a genuine Voyage 429 (rate limit) from this session's own heavy testing traffic — external and transient, not a code defect. **Resolved 2026-07-22:** re-ran `prisma/ingest-bellevue.mjs` (idempotent) once the rate-limit window cleared — now `NEEDS_REVIEW` like the rest, no longer `FAILED`.

**Two real code bugs found and fixed during this verification pass:**
- `EmbeddingsService.embed`'s retry logic retried every failure (including non-retryable 401/400) identically — now only 429/5xx retry, others fail fast.
- `IngestionService.ingestNow` performed a redundant status-read transaction after `processDocument` already computed the same value — an extra place to flakily hit Prisma's interactive-transaction timeout under Supabase pooler load (real live `P2028` errors observed under this session's heavy DB traffic). Fixed: `processDocument` now returns its status directly. `ingest-bellevue.mjs`'s batch loop also now isolates per-document failures instead of aborting the whole batch on one error — verified live (a full 7-document batch completed cleanly after the fix, vs. crashing partway through before it).

**Current blocker — the AI Gateway account reverted to free-tier restrictions 2026-07-22** (`Free tier users do not have access to this model`), despite the card added 2026-07-21 and a live $4.95 balance shown in the Vercel dashboard — that balance looks like unused free starter credit, not a purchase; the account likely needs an actual credit purchase (not just a card on file) to unlock restricted models. Every document ingested since reverted to `NEEDS_REVIEW` via the EXTRACTING-stage failure path (correct behavior, not a new bug) — visible directly now via `validationIssues`, e.g. "Entity extraction failed: Free tier users do not have access to this model...". User is aware, deferred purchasing credit for later — don't nag.

> **Milestone — could show someone at this point:** upload a real hotel document, ask the widget a question about it, get a grounded answer back. **Reachable once AI Gateway credit is purchased** (extraction → INDEXED → retrievable); the pipeline and the full admin upload surface that produce it are both built and proven — this is now purely an account-billing gate, not missing code.

## Sprint 3 — Full Behavior Spec

**Relative effort:** Medium — mostly composing pieces that already exist (retrieval, the classifier's domain/persona output) rather than building new infrastructure.

**Definition of done:** every Golden Set scenario in the Playbook passes by hand, one by one, as its behavior lands ([Development Plan Phase 3](11-development-plan.md)) — not saved up and discovered broken at the end.

- [x] Entity CRUD + search endpoints, all nine types ([API §3.3](09-api-specification.md)) — `GET/POST/PATCH/DELETE /v1/admin/entities/:type[/:id]` + `GET /v1/admin/entities/search`, one generic `EntitiesService` driven by a per-type field registry (`apps/api/src/admin/entities/entity-config.ts`) rather than nine near-identical services. `PropertyProfile` deliberately excluded — DB §6 documents it as a hotel-wide singleton, not one of "the nine", with no CRUD shape defined anywhere yet. Guarded by the same `SupabaseAuthGuard` + `HotelScopeGuard` pair as knowledge routes; all queries through `prisma.withTenant` (real RLS); soft delete only (`deletedAt`, never a hard delete), matching every other entity table. Live-verified against the real Bellevue hotel (`apps/api/verify-entities.mjs`, 12/12 checks): required-field + wrong-type rejection, create/get/list/update/soft-delete round trip, and search across both a `name`-keyed entity (RoomType) and the one type keyed on a different field (`Policy.topic`). Types/SDK additions: `EntityByParam`/`EntitySearchResult` in `packages/types`, `listEntities`/`getEntity`/`createEntity`/`updateEntity`/`deleteEntity`/`searchEntities` in `packages/sdk`. No admin UI screen yet — this is the API surface only, per the ticket.
- [x] `EntityRelationship` CRUD + `/relationships/preview` ([API §3.3](09-api-specification.md), [IA §12](03-information-architecture.md)) — `GET/POST/DELETE /v1/admin/relationships[/:id]` (filterable by `contextTag`) + `POST /v1/admin/relationships/preview`. Hard delete, not soft — unlike the nine entity tables, `EntityRelationship` has no `deletedAt` column. App-layer existence validation on `fromEntityId`/`toEntityId` at create time (the schema has no FK there by design, per its own comment). New shared `CardAssemblyService` (`apps/api/src/ai/card-assembly.service.ts`, exported from `AiModule`) is the one card-assembly implementation — `preview` calls it directly, and ticket 3 wires the same call into the live guest `card` SSE event, so the two can't drift (API §3.3's explicit requirement).
  - **Real, discussed-with-user gap, not silently patched:** no entity table or `EntityRelationship` row has a field for a card's `title`/`hook` copy anywhere in the schema — checked DB §6, API §2.1/§3.3, UX §3/§10, AI Engine §1/§4; none specify where it comes from. Asked the user how to proceed; decided (their call, not assumed): `title` = the entity's own name/topic field (uncontroversial), `hook` = a deterministic string templated per entity type from its *existing* fields (`apps/api/src/common/entities/entity-display.ts`) — no model call (matches AI Engine §1's call inventory, which has no card-assembly step, and §4's deterministic reranking), no schema change. `imageUrl`/`linkUrl` stay `null` (already optional in the type). Real admin-authored bundle copy is still an open design question — a schema addition is the likely real fix, not something this ships silently as final.
  - Refactored `entity-config.ts` from `admin/entities/` to `common/entities/` (Sprint 3 ticket 1 hadn't needed to share it yet; ticket 2's card assembly does) — same registry, no duplicated "which field is the title" logic between the entities CRUD surface and card assembly.
  - Live-verified against the real Bellevue hotel (`apps/api/verify-relationships.mjs`, 15/15 checks): all four validation guards (missing field, unknown entity type, non-existent entity id, invalid priority), create/get/list/contextTag-filter/hard-delete round trip, and `preview` producing a real deduped, priority-ordered 3-card bundle (Ocean View Suite + The Terrace + Deep Tissue Massage) from two relationship edges — reconstructing IA §12's own anniversary-bundle example against live data.
- [x] `card` SSE event wired to relationship-bundle retrieval ([API §2.1](09-api-specification.md)) — test directly against **G-05** (anniversary bundle) — `ChatService.streamTurn` now calls the shared `CardAssemblyService` (ticket 2) after generation completes, gated correctly: fires at most once, only after the final `delta` (API §2.1's ordering guarantee), only in Planning/Booking Intent journey states (ABS §16/§18), never on Service Recovery (ABS §19 — verified explicitly, including the adversarial case of a contextTag *and* an occasion both being set during Service Recovery), never on the Low-Confidence fallback path, and never as an empty event when a contextTag has no curated bundle behind it (`entities/entity-config.ts`'s `PROPERTY_PROFILE` exclusion also applies here — not every `EntityType` is card-eligible). `contextTag` resolution prefers the guest's own quick-start tap (request body, already wired since Sprint 1) over the classifier's free-text `detectedSignals.occasion` — both paths tested.
  - Seeded the real `anniversary` bundle for Bellevue (`apps/api/prisma/seed-relationships.mjs`, idempotent) — Ocean View Suite + The Rooftop at Bellevue + Couples Massage, IA §12's own worked example, reused verbatim by G-05. Without this the wiring would be correct but empty.
  - **Billing blocker discovered while verifying this ticket — resolved same-day (2026-07-23).** Voyage embeddings were briefly ALSO rate-limited (`429`, "You have not yet added your payment method... reduced rate limits of 3 RPM and 10K TPM") — separate from the already-documented AI Gateway classifier restriction below. User added a Voyage payment method; confirmed live with a direct `voyage-4` call (real `200`, real embedding returned) — real retrieval is unblocked now. **The AI Gateway classifier model (haiku) is still on its own separate, still-blocked account** (`verify-gateway.mjs`: classifier `FAIL`, generation `PASS` — sonnet-5 generation works, only the classifier's model access is restricted) — a live, fully unstubbed end-to-end proof of G-05 (real classifier detecting `journeyState: planning` + `occasion: anniversary` from the actual guest message) still needs that credit purchase. One of the two blockers is closed, not both — don't conflate them.
  - Live-verified against the real Bellevue hotel (`apps/api/verify-chat-cards.mjs`, 14/14 checks): one fully unstubbed run proving the current safe degraded behavior (classifier down → `journeyState: information` → card correctly suppressed, not a bug), plus five runs that stub only the two currently-blocked provider calls (`GatewayService.classify`, `EmbeddingsService.embedQuery` — the latter returning a real chunk's own already-embedded vector, not a fabricated one) so every other real code path — retrieval SQL, confidence scoring, real streamed generation (sonnet-5, which **is** live), and real card assembly against the real seeded bundle — is exercised for real: G-05 itself (exact 3-entity deduped bundle, correct SSE ordering), the quick-start-tap contextTag path, Service Recovery suppression, Information-state suppression, and the uncurated-tag-yields-no-event case.
- [x] Lead capture: Yes/No confirmation, one field at a time, `POST /chat/lead` idempotent on `promptId` ([UX §4](05-user-experience-flows.md), [API §2.2](09-api-specification.md)) — test against **G-02, G-18**. `ChatService` emits the Yes/No `lead_prompt` trigger only (same journey-state/confidence gate as `card`, plus never re-asking once a Lead row already exists for the conversation — ABS §8's "don't ask again"); every subsequent field-by-field step happens entirely inside `POST /v1/chat/lead`'s own request/response cycle, `nextField` driving the client without it guessing, per the endpoint's own doc comment. New `LeadsService` (`apps/api/src/leads/`, its own module so Sprint 4's admin leads inbox can reuse it rather than re-implementing) does the actual capture: find-or-create scoped to `conversationId`, one field validated and written at a time (`dates`→`travelDates`, `email`→`email`), decline recorded (blocks re-asking) without capturing anything.
  - **Idempotency design choice, stated plainly rather than left implicit:** `Idempotency-Key`/`promptId` is accepted per the API spec, but the actual guarantee ("a double-tap creates one lead, not two") comes from find-or-create-by-`conversationId`, not a stored promptId ledger. Deliberately not a DB-level unique constraint on `conversationId` — `Conversation.leads` is a real one-to-many relation in the schema (a conversation can legitimately have more than one lead-capture moment over its life); a hard constraint would fight that. This means the guarantee is "the current in-progress chat-triggered ask never duplicates," not "a conversation can never have two Lead rows ever" — the latter isn't the schema's own intent.
  - Field order for the chat-triggered ask is `dates` then `email` (UX §4's own worked example) — a fixed 2-field cap, not the full PRD FR-007 menu (name/phone/budget/etc., which stays available to other flows — manual entry, escalation contact capture — not this one).
  - Live-verified against the real Bellevue hotel (`apps/api/verify-lead-capture.mjs`, 17/17 checks, same stubbing approach and same two billing caveats as ticket 3's script): G-02's full field-by-field round trip including an idempotent resubmission (confirmed exactly one Lead row), never re-asking in the same conversation, G-18's contrast pair (no signal → no prompt; specific dates+occasion+preference → prompt fires, and correctly co-occurs with a `card` event in the same turn), the decline path, and Service Recovery suppression.
- [ ] Escalation: `escalation` event + `POST /chat/escalation/choose` ([UX §5](05-user-experience-flows.md), [API §2.3](09-api-specification.md)) — test against **G-11** (this one especially: confirm zero recommendation/upsell activity once it fires)
- [ ] Wire the remaining prompt modules — `wedding`, `spa`, `family-travel`, `business-travel` — composed onto `base.md` by the classifier's `domain`/`persona` output. Use [Prompts 1–5](15-prompt-library-implementation-prompts.md) directly, one per module. ([AI Engine §3](10-ai-engine-specification.md))
- [ ] `cta` event, lifecycle-stage logic ([UX §6](05-user-experience-flows.md))
- [ ] Run the full Golden Set (**G-00 through G-19**) by hand as each piece above lands

> **Milestone — could show someone at this point:** the full guest experience — recommendation cards, lead capture, escalation handling — on the bare unstyled page. This is functionally the whole product; only its appearance and the admin surfaces are still missing.

## Sprint 4 — Admin Portal Completion

**Relative effort:** Medium — mostly surfaces over data Sprints 1–3 already produce, per its own Definition of Done below.

**Definition of done:** staff can see everything Phases 1–3 already produced — no new backend concepts this sprint, only surfaces ([Development Plan Phase 4](11-development-plan.md)).

- [ ] Dashboard KPI tiles reading `DailyMetric` rollups ([API §3.6](09-api-specification.md))
- [ ] Conversation list + thread view + QA scoring ([API §3.4](09-api-specification.md))
- [ ] Leads inbox, including manual entry ([API §3.4](09-api-specification.md))
- [ ] Brand Settings — live preview + WCAG contrast validation on save ([API §3.5](09-api-specification.md), [UI Design System §10](08-ui-design-system.md))
- [ ] Relationship Bundle builder with live guest-card preview ([UX §10](05-user-experience-flows.md))
- [ ] Analytics: topics distribution + Missing Information panel ([API §3.6](09-api-specification.md), [UX §12](05-user-experience-flows.md))
- [ ] Notifications wired to real events (new lead, escalation, ingestion failure) ([API §3.7](09-api-specification.md))
- [ ] `/session`, hotel CRUD, role-gating verified per role — VIEWER can't mutate anything, MARKETING can't reassign leads, etc. ([API §3.1](09-api-specification.md))

> **Milestone — could show someone at this point:** the full business case, not just the chat. Leads in the inbox, conversations reviewable, the Missing Information panel showing real gaps. Still unstyled — this is the "show business value" checkpoint, not the "show Adam" checkpoint.

## Sprint 5 — Visual Design System + Demo Property

**Relative effort:** Medium, contingent on the A/B/C/D decision landing early — the work itself (tokenizing components, building one demo page) is well-scoped once that choice is made.

**Definition of done:** the chosen design system is applied to real, working screens — not a mockup — and the Bellevue demo property is a real running site with the widget embedded on it ([Development Plan Phase 5](11-development-plan.md)).

- [ ] **Resolve the A/B/C/D decision** ([UI Design System](08-ui-design-system.md)) — this sprint is blocked without it
- [ ] Apply chosen tokens/components to `packages/ui`
- [ ] Scaffold `apps/demo-bellevue` — Home, Rooms, Dining, Spa, Weddings, Explore pages, real content and photography per [docs/16](16-demo-property-content.md), not placeholders
- [ ] Build the embeddable widget script (bundled `<script>`-mountable entry point, [Architecture §3](06-system-architecture.md)) — this is what `apps/demo-bellevue` actually embeds, not a React import
- [ ] Embed the real widget script on the demo site via a real widget key; walk the full launcher-delay → conversation → lead-capture flow end to end on the actual running page, not locally
- [ ] If time allows: layer Option D's Breath/Discretion behavior on top ([UI Design System Option D](08-ui-design-system-option-d.md), [Sales Demo Script §7](13-sales-demo-script.md))

> **Milestone — could show someone at this point:** this is the actual Adam demo, per the [Sales Demo Script](13-sales-demo-script.md). Premium-looking, on a real running site, with a real hotel's content behind it.

## Sprint 6 — QA Pass, Pilot & Demo Prep

**Relative effort:** Low in scope, high in stakes — this is verification, not new construction, but it's the sprint that decides whether the meeting actually goes well.

**Definition of done:** the [PRD §20](01-PRD-ai-concierge.md) success criteria are demonstrated true, not assumed true, and the demo script has been rehearsed against the real product ([Development Plan Phase 6](11-development-plan.md)).

- [ ] Full 60-scenario Playbook run against the actual, deployed system prompt — log every pass/fail
- [ ] Fix everything the Playbook catches; re-run until clean
- [ ] Confirm each [PRD §20](01-PRD-ai-concierge.md) line item directly: upload-to-live under 30 minutes, accurate answers, leads actually captured, staff can review conversations/analytics
- [ ] Rehearse the [Sales Demo Script](13-sales-demo-script.md) live, start to finish, at least twice, on the real demo property
- [ ] Give the meeting

## Open Items Carried Forward

These aren't sprint-blocking but shouldn't get lost:

- [ ] Upstash free-tier usage check before onboarding a second hotel ([Development Plan §5](11-development-plan.md))
- [ ] Revisit deterministic reranking vs. a learned reranker once real pilot data exists ([AI Engine §4](10-ai-engine-specification.md))
- [ ] Model-switch mechanism is currently per-hotel only (`PromptOverride.model`) — no documented platform-wide fallback switch if a provider goes down; worth a real mechanism once it's not purely theoretical

---

**Next:** there isn't one. This is the working list — update it, don't replace it.
