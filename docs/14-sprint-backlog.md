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
- [ ] **Confirm Voyage AI's actual embedding output dimension** before writing the first migration — `vector(1024)` in the schema docs is a placeholder that must match whichever model is actually picked ([DB §5](07-database-design.md))
- [x] **Spike:** get NestJS running behind a single Vercel Function — resolved via Vercel's own current docs: zero-config, no custom adapter (Architecture §3, corrected). `apps/api/src/main.ts` already matches the required entrypoint convention exactly. Live deploy test still pending an actual linked Vercel project (see above).
- [x] Scaffold the monorepo: `apps/web` (Next.js 16), `apps/api` (NestJS 11), `packages/{ui,types,prompts,sdk,config}` ([Engineering Conventions §2](12-engineering-conventions.md)) — `pnpm install` clean across all 7 workspace packages
- [x] Prisma schema written in full (`apps/api/prisma/schema.prisma`, transcribed from [DB Design](07-database-design.md)), validated, and **applied to the live Supabase project** — three tracked migrations (`0_init`, `1_rls_policies`, `2_app_role`), `prisma migrate status` clean.
- [x] Adversarial test: two hotels created directly, a session connected as the restricted `app_role` and scoped to Hotel A queried both `Hotel` and `RoomType` — Hotel B's rows were completely absent from both result sets. **PASS.** Discovered along the way that this required a genuinely separate, non-owning Postgres role (`app_role`) — RLS policies alone do nothing against the migration-owning role, since Postgres table owners bypass RLS by default. Documented in [DB §9](07-database-design.md).
- [x] Set up Git workflow — `main`/`develop`/`feature/*`, PR-only merges even solo ([Engineering Conventions §8](12-engineering-conventions.md))
- [x] Configure ESLint + Prettier, Husky pre-commit hook (lint + typecheck), Commitlint ([Engineering Conventions §8](12-engineering-conventions.md))

## Sprint 1 — Core Chat Pipeline + Admin Shell

**Relative effort:** High — this is where the actual technical risk concentrates (retrieval, confidence gating, streaming all get proven for the first time).

**Definition of done:** a real question, asked against hand-entered test content, gets a real grounded answer, streamed, inside the latency budget — no cards, no lead capture, no escalation yet ([Development Plan Phase 1](11-development-plan.md)). Separately: a human can actually log into the admin app and see an empty shell.

**Admin shell (parallel track — this was a real gap, nothing built it before now):**
- [ ] Login page, wired directly to Supabase Auth (email/password or magic link) — no custom `/auth/login` endpoint, per [API §3.1](09-api-specification.md)'s explicit decision
- [ ] `GET /v1/admin/session` call on load — maps the Supabase JWT to memberships/roles ([API §3.1](09-api-specification.md))
- [ ] Protected routes / route guard in the Next.js admin app
- [ ] Minimal shell: sidebar nav (labels only, screens land in later sprints) + header — enough to log into and see *something*

**Chat pipeline:**
- [ ] Seed one hotel with a handful of hand-entered rows (a few `RoomType`, `Restaurant`, `Policy` records) — not real ingestion yet
- [ ] `GET /v1/chat/bootstrap` ([API §2.4](09-api-specification.md))
- [ ] Scaffold `packages/prompts` and wire the **classifier prompt** to the AI Gateway on the small/fast model tier — use [Prompt 0](15-prompt-library-implementation-prompts.md) directly, don't re-derive it ([AI Engine §2–3](10-ai-engine-specification.md))
- [ ] Retrieval query: domain-filtered vector similarity + entity joins ([IA §7](03-information-architecture.md))
- [ ] Deterministic rerank formula — `0.65×similarity + 0.20×priority + 0.15×recency` ([AI Engine §4](10-ai-engine-specification.md)) — as a unit-tested pure function, not inline in the request handler
- [ ] Confidence formula — `0.5×similarity + 0.3×agreement + 0.2×classifier certainty` ([AI Engine §5](10-ai-engine-specification.md)) — same, unit-tested in isolation
- [ ] Low-Confidence path: route to the honest fallback *without* calling the generation model ([ABS §6](02-ai-behavior-specification.md))
- [ ] `POST /v1/chat/message` SSE endpoint — `ack`/`delta`/`done` events only; `card`/`lead_prompt`/`escalation`/`cta` deferred to Sprint 3 ([API §2.1](09-api-specification.md))
- [ ] Wire `base.md` + `general.md` module only ([AI Engine §3](10-ai-engine-specification.md)) — domain/persona modules deferred to Sprint 3
- [ ] Minimal widget: renders streamed plain text and the `ack` cue in a bare unstyled page — no design system yet
- [ ] Verify the latency budget end to end against real infra, not the theoretical numbers — `ack` ≤300ms, first generation token inside the ~1–1.4s range ([AI Engine §6](10-ai-engine-specification.md))

## Sprint 2 — Knowledge Ingestion

**Relative effort:** High — second only to Sprint 1; parsing and structured extraction across varied real documents is where the messy edge cases live.

**Definition of done:** a document uploaded through the admin screen ends up as retrievable, correctly-tagged chunks — and the pilot/demo content can start being loaded for real ([Development Plan Phase 2](11-development-plan.md)).

- [ ] `POST /v1/admin/knowledge/documents` — multipart upload + URL-sync variant ([API §3.2](09-api-specification.md))
- [ ] Ingestion worker: parse → **entity-extraction prompt** ([AI Engine §3](10-ai-engine-specification.md)) → chunk → tag → embed (Voyage) → validate ([IA §5](03-information-architecture.md))
- [ ] `IngestionJob` per-stage status rows, queryable ([DB §5](07-database-design.md))
- [ ] Admin upload screen: status badges (Indexed/Needs Review/Failed), chunk preview, guided Needs Review form ([UX §9](05-user-experience-flows.md))
- [ ] Bulk reindex endpoint ([API §3.2](09-api-specification.md))
- [ ] **Start authoring the Bellevue demo property's content** in parallel — rooms, dining, spa, policies, wedding page ([Development Plan's parallel task](11-development-plan.md), [Sales Demo Script §4](13-sales-demo-script.md)) — this both tests real ingestion and produces the demo's actual material

> **Milestone — could show someone at this point:** log in, upload a real hotel document, ask the widget a question about it, get a grounded answer back. Rough, unstyled, but genuinely working end to end — not a mockup.

## Sprint 3 — Full Behavior Spec

**Relative effort:** Medium — mostly composing pieces that already exist (retrieval, the classifier's domain/persona output) rather than building new infrastructure.

**Definition of done:** every Golden Set scenario in the Playbook passes by hand, one by one, as its behavior lands ([Development Plan Phase 3](11-development-plan.md)) — not saved up and discovered broken at the end.

- [ ] Entity CRUD + search endpoints, all nine types ([API §3.3](09-api-specification.md))
- [ ] `EntityRelationship` CRUD + `/relationships/preview` ([API §3.3](09-api-specification.md), [IA §12](03-information-architecture.md))
- [ ] `card` SSE event wired to relationship-bundle retrieval ([API §2.1](09-api-specification.md)) — test directly against **G-05** (anniversary bundle)
- [ ] Lead capture: Yes/No confirmation, one field at a time, `POST /chat/lead` idempotent on `promptId` ([UX §4](05-user-experience-flows.md), [API §2.2](09-api-specification.md)) — test against **G-02, G-18**
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
- [ ] Build the Bellevue demo property site (hero, rooms, dining, spa, wedding page) with licensed/generated photography ([Sales Demo Script §4](13-sales-demo-script.md))
- [ ] Embed the real widget on it; walk the full launcher-delay → conversation → lead-capture flow end to end on the actual running page, not locally
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
