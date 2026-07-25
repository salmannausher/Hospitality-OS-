# Findings & Blockers Log

**This is the single source of truth for every blocker and behavior/spec finding on this project — billing/account blockers and real findings alike.** CLAUDE.md and the [Sprint Backlog](14-sprint-backlog.md) point here instead of duplicating the narrative.

**Standing rule: every new finding or blocker gets an entry here *first*, the moment it's discovered** — before it gets fixed, and even if it's fixed in the same session. Backfilling this log later is not the workflow; logging as you go is. A one-line pointer from CLAUDE.md's status section or a Sprint Backlog ticket is fine, but the actual problem/root-cause/fix narrative lives here, once, not copied across three files that can drift out of sync.

## Entry format

```
### N. Title — STATUS

**Found:** sprint/date, what surfaced it (a ticket, a live test, a Golden Set scenario, an account notification)
**Problem:** what broke, was missing, or blocked progress
**Root cause:** why it happened
**Fix chosen — and why:** what was actually done, the alternatives that were considered and rejected, and the reasoning
**Verification:** how it was proven (a script, a live test, a PR)
```

`STATUS` is one of: **OPEN** (known, not yet fixed) · **FIXED** (resolved, verified) · **DEFERRED** (a deliberate decision not to fix now, with a stated reason) · **MITIGATED** (partially addressed, full fix still open).

---

### 1. AI Gateway free-tier billing restriction — OPEN

**Found:** Sprint 1, reconfirmed throughout Sprint 2/3's live verification scripts.
**Problem:** The AI Gateway account reverted to free-tier restrictions (`Free tier users do not have access to this model`) despite a card on file, blocking real live classifier calls (haiku) and real ingestion-time entity extraction. Generation (sonnet-5) works fine — only classifier/extraction-tier model access is restricted.
**Root cause:** Account billing state, not code — the $ shown in the Vercel dashboard is unused free starter credit, not a purchase. A card on file alone doesn't unlock restricted models; an actual credit purchase does.
**Fix chosen — and why:** Not a code fix — every Sprint 2/3 verify script stubs `GatewayService.classify`'s *output* to the exact classification a working classifier would produce for the scenario under test, so the rest of the pipeline (retrieval, scoring, generation, card/escalation/lead/cta logic) is exercised for real. This was chosen over waiting to build/verify anything classifier-dependent, since the blocker is the user's own pending action, not something code can work around. `verify-gateway.mjs` is the direct probe — rerun it any time to check if this has resolved.
**Verification:** `apps/api/verify-gateway.mjs` (classifier `FAIL` / generation `PASS` as of last check). Not resolved — don't nag the user about it, they're aware and have deferred it.

### 2. Voyage embeddings rate-limiting — FIXED (2026-07-23)

**Found:** Sprint 3, while live-verifying the `card` SSE event (ticket 3).
**Problem:** Voyage embeddings started returning `429`s — "You have not yet added your payment method... reduced rate limits of 3 RPM and 10K TPM."
**Root cause:** Voyage's policy: 200M free tokens apply regardless of payment method, but *without* one, rate limits are heavily restricted; adding a payment method unlocks standard limits, with the free allowance still stacking on top. No payment method was on file.
**Fix chosen — and why:** User added a payment method (their own account action, not a code fix). Confirmed via a direct unstubbed `voyage-4` call returning a real `200` and a real embedding vector.
**Verification:** Direct `fetch` probe against `https://api.voyageai.com/v1/embeddings` — `200`, real embedding returned. Re-ran the ticket-3 verify script's fully-unstubbed path afterward with no change in behavior (confirming the fix didn't regress anything).

### 3. Classifier domain under-tagging vs. IA §7's hard-filtered retrieval — MITIGATED

**Found:** Sprint 1, live testing.
**Problem:** Asking "What time is breakfast served?" produced a fluent but wrong "I don't have that information" answer. The classifier tagged the message `domain: ["accommodation"]` (should have included `dining`/`policies`), and retrieval hard-filters on domain overlap (IA §7's explicit, documented "mandatory, not optional" design) — so the correct breakfast chunk never entered the candidate set. Confidence still computed MEDIUM (not LOW) on whatever *did* get retrieved, so generation ran instead of the safe fallback.
**Root cause:** The pipeline did exactly what it was built to do — an imperfect classifier tag combined with a hard filter that has no fallback path.
**Fix chosen — and why:** Discussed with the user first (three options proposed). Chose the smallest one: `packages/prompts/classifier.md` now explicitly instructs the classifier to tag every domain a query plausibly touches, not just the single best-fit one, with the breakfast case spelled out as a worked example. Rejected, for now: (a) domain as a rerank *boost* instead of a hard predicate, (b) a fallback retry without the domain filter on LOW/empty results — both are real architecture changes to IA §7's retrieval design, not something to decide unilaterally mid-fix.
**Verification:** Prompt change shipped 2026-07-22; live re-verification of the specific breakfast query was blocked on the AI Gateway restriction (finding 1) at the time. If the gap resurfaces once that's resolved, the belt-and-suspenders fallback-retry option is the next step, not the rejected soft-filter option.

### 4. Needs-Review edit form has no way to trace a validation issue to its source entity — DEFERRED

**Found:** Sprint 2, while building the admin knowledge upload surface.
**Problem:** UX §9's guided, pre-filled Needs-Review edit form needs to trace a validation issue back to the specific entity row it came from (e.g., "Ocean Suite is missing capacity" → jump straight to editing that `RoomType` row). None of the nine entity tables has a link back to the document/extraction it came from.
**Root cause:** A schema gap — only `Chunk` has a `documentId` link; the nine structured-entity tables (`RoomType`, `Restaurant`, etc.) don't.
**Fix chosen — and why:** Deliberately not built. Adding a `documentId` FK is a migration across all nine entity tables — a real architecture decision (does every entity need this, or only ones created via extraction vs. admin CRUD?), not surface work to bolt on while building the upload screen. `Document.validationIssues` ships as read-only in the meantime, so admins can see *what's* wrong even though they can't yet jump to fixing it from a pre-filled form.
**Verification:** N/A — deliberately unbuilt. Revisit when the guided edit form itself is scoped (likely Sprint 4 admin portal work).

### 5. `RecommendationCard`'s `title`/`hook` had no source field anywhere — FIXED (Sprint 3, ticket 2)

**Found:** Sprint 3, while implementing `POST /v1/admin/relationships/preview`.
**Problem:** The card preview endpoint needs to return `{ title, hook, imageUrl?, linkUrl? }` per entity, but no entity table or `EntityRelationship` row has a field for authored copy. UX §3/API §2.1 reference "the entity's own hook" as if it already exists; it doesn't.
**Root cause:** A genuine, undocumented gap — checked DB §6, API §2.1/§3.3, UX §3/§10, AI Engine §1/§4; none specify where this copy comes from.
**Fix chosen — and why:** Asked the user directly (three options: deterministic template / schema addition to `EntityRelationship` / schema addition to all nine entity tables). User chose the deterministic template: `title` = the entity's own name/topic field; `hook` = a string templated per entity type from *existing* fields (e.g. RoomType → `"ocean view · sleeps 4"`), no schema change, no model call — consistent with AI Engine §1's call inventory (no card-assembly model call) and §4's deterministic reranking. `imageUrl`/`linkUrl` stay `null` (already optional in the type). Rejected: both schema-addition options, since real admin-authored bundle copy is a bigger, separate decision not needed to unblock this ticket.
**Verification:** `apps/api/verify-relationships.mjs` (15/15 checks) — confirmed titles/hooks render correctly for both a `name`-keyed entity (RoomType) and the one type keyed differently (`Policy.topic`).

### 6. `cta` event had no URL source anywhere in the schema — FIXED (Sprint 3, ticket 6)

**Found:** Sprint 3, while implementing the `cta` SSE event.
**Problem:** Every `cta` kind requires a `url: string`, but nothing in `Hotel`/`BrandSettings`/`PropertyProfile` holds a booking-engine link, a rooms page, or any other CTA target.
**Root cause:** No hotel-configurable link field exists anywhere in the schema — genuinely undecided, not an oversight in one place.
**Fix chosen — and why:** Asked the user directly (three options: add one configurable field / ship a placeholder URL pattern / defer the whole ticket). User chose adding `BrandSettings.bookingEngineUrl` (migration `7_brand_settings_booking_url`, additive/nullable). `book_now` and `explore_rooms` both point to it (realistic — most real hotel sites route both into the same booking engine). `plan_my_stay` falls back to the same URL as an explicitly-flagged interim decision (a dedicated itinerary/local-guide URL is a separate, real gap). `request_assistance` never uses it — UX §6 frames that CTA as triggering in-widget escalation, not a link-out. Unconfigured → empty string, never a fake link. Rejected: the placeholder-URL option (too risky for the upcoming Bellevue demo work) and deferring the whole ticket (a small, real schema addition was cheap and unblocked everything else).
**Verification:** `apps/api/verify-cta.mjs` (24/24 checks) — configured-vs-unconfigured behavior for all four CTA kinds, live against the real Bellevue hotel.

### 7. Missing classifier signals for two ABS §7/Playbook §6 concepts — FIXED (Sprint 3, tickets 5 & 6)

**Found:** Sprint 3, while implementing escalation (ticket 5) and the `cta` event (ticket 6).
**Problem:** Two documented behaviors had no classifier signal to detect them: (a) ABS §7's "explicit request to talk to a person" is independent of `journeyState: service_recovery`, but `ClassifierOutput` had no field for it; (b) Playbook §6's Trip Lifecycle Stage (`dreaming → researching → comparing → booking → preparing → staying`) is a second axis from `journeyState`, and nothing captured it at all.
**Root cause:** Both concepts were fully specified in the docs but never wired into the classifier's structured output schema.
**Fix chosen — and why:** Extended `ClassifierOutput.detectedSignals` with `explicitHandoffRequest: boolean` and `lifecycleStage: LifecycleStage`, both inferred from explicit language in the message or conversation history per updated `classifier.md` instructions, each with a safe, documented default when ambiguous (`false` / `"researching"`). Chosen over keyword-matching heuristics (fragile, not real detection) or leaving the behaviors unbuilt — the Playbook's own text explicitly says lifecycle stage "can often be inferred from explicit language... without new infrastructure," which is exactly what this does.
**Verification:** `apps/api/verify-escalation.mjs` and `apps/api/verify-cta.mjs` — both signals exercised live end to end through `ChatService.streamTurn`.

### 8. Card/text divergence — the two recommendation surfaces didn't cross-reference each other — FIXED (2026-07-26)

**Found:** Sprint 3's full Golden Set run (G-05) — see [the run log](sprint-3-golden-set-run.md).
**Problem:** The `card` SSE event correctly returned the real seeded `anniversary` bundle (Ocean View Suite + The Rooftop at Bellevue + Couples Massage), but the *generated answer text* recommended a different restaurant — The Terrace — for dinner. The guest would see a card naming one restaurant and read a paragraph naming another, in the same turn.
**Root cause:** Card assembly (`EntityRelationship` lookup) and answer generation (vector retrieval → RAG context) were two fully independent systems with no cross-referencing — retrieval had no idea what the card mechanism had already picked.
**Fix chosen — and why:** `ChatService` now resolves the relationship bundle *before* generation (moved up from after), and — when one fires — injects a "you must recommend precisely these entities" instruction into the system prompt, folded into the existing `{{rag_context}}` slot rather than a new `base.md` placeholder (`base.md`/ABS §14 is a shared prompt-template contract, deliberately out of scope for a targeted fix — see finding 9). The already-resolved bundle is reused for the `card` event itself instead of being queried a second time — one lookup, not two. Considered and rejected: biasing vector retrieval toward the bundle's entities instead (more invasive, touches the shared retrieval scoring path for a fix that's really about generation-time instructions).
**Verification:** `apps/api/verify-card-text-consistency.mjs` — reproduces the exact G-05 scenario; text now names "The Rooftop at Bellevue," matching the card. All five other chat-pipeline verify scripts re-run clean afterward — zero regressions.

### 9. Escalation fires for the wrong documented reason on wedding/events inquiries — OPEN

**Found:** Sprint 3's full Golden Set run (G-09, G-10) — see [the run log](sprint-3-golden-set-run.md).
**Problem:** Both scenarios did escalate, but via the `low_confidence` trigger (Bellevue has zero indexed `events`-domain content, so retrieval returns empty) rather than ABS §7's "group/event size threshold" trigger. The `Escalation` row's logged `reason` (`low_confidence`) doesn't reflect the real cause (a high-value group inquiry), which would misdirect any reason-based analytics later (API §3.6's planned "grouped by structured `reason`" view).
**Root cause:** Two compounding gaps: (1) the real group/event-size-threshold trigger was never built — "configurable size threshold" implies a per-hotel setting that doesn't exist anywhere in the schema; (2) no `events`-domain content is seeded for Bellevue, so even a correct trigger would have nothing to ground a helpful capacity/AV-facts answer with.
**Fix chosen — and why:** Not yet fixed — flagged here rather than building a hardcoded threshold number to make this specific Golden Set scenario look right. The real fix needs a schema decision (where does the per-hotel threshold live — `BrandSettings`? a new settings table?) plus real `EventSpace` content, not a guess made mid-QA-run.
**Verification:** N/A yet. Re-run `apps/api/run-golden-set.mjs`'s G-09/G-10 scenarios once a real trigger + real events content both exist.

### 10. `base.md` never received ABS §10/§19's refusal-table content — OPEN

**Found:** Sprint 3's full Golden Set run (G-12) — see [the run log](sprint-3-golden-set-run.md).
**Problem:** The actual system prompt template (`packages/prompts/base.md`) — which correctly and deliberately copies ABS §14 verbatim — never included ABS §10's refusal rules (competitor comparisons, prompt-extraction, medical/legal/financial, harassment) or the ABS §19 forbidden-behaviors checklist anywhere in its text.
**Root cause:** Not a code bug — `base.md` faithfully matches the spec section it's supposed to (§14). The gap is *between two spec sections*: §10 and §19 document required refusal behaviors that §14 (the section actually wired into the running system) never references. Made concrete by G-12: a competitor-comparison question scored Low Confidence on retrieval and never even reached generation, so neither an explicit instruction (none exists) nor the model's own default judgment got a chance to apply. G-13 (prompt-extraction) succeeded — but on the model's own default alignment, not anything this system actually specifies, so that success is incidental, not guaranteed.
**Fix chosen — and why:** Not yet fixed. Expanding `base.md`/ABS §14 to include §10/§19's rules is a deliberate prompt-content decision (and a `registry.ts`/Playbook-coverage update) — flagged here rather than silently patched during a QA run, consistent with how every other shared-prompt-contract change on this project has been handled (ask first, per findings 5 and 6 above).
**Verification:** N/A yet. Re-run `apps/api/run-golden-set.mjs`'s G-12/G-13 scenarios once `base.md` is deliberately updated.

---

**Next entry number: 11.**
