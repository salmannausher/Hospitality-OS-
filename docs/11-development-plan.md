# Development Plan

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** everything in [docs/README.md](README.md)

Every other document specified *what to build*. This one is the build order — deliberately the shortest document here, because it's a sequence, not more design. If you're deciding what something should do, that decision already exists in an earlier doc; this one just says which week you build it.

---

## 1. Before Week 1 — Environment

- Repo scaffold per [Architecture §3](06-system-architecture.md): `apps/web` (Next.js), `apps/api` (NestJS), shared `packages/` for types generated from the Prisma schema.
- Provision: Supabase project (Postgres + pgvector extension + Auth + Storage), Upstash Redis, Vercel project (Hobby tier is fine until go-live — [Architecture §8](06-system-architecture.md)), AI Gateway access.
- **First spike, before any feature work:** get NestJS actually running as a single Vercel Function via the serverless adapter ([Architecture §3](06-system-architecture.md)). This is the one part of the stack with no prior art in this project — confirm it works with a "hello world" route before building anything on top of it. If it doesn't work cleanly, that's the moment to know, not week 3.
- Confirm the Voyage AI embedding model's actual output dimension before writing the first Prisma migration — `Chunk.embedding vector(1024)` ([DB §5](07-database-design.md)) is a placeholder for whichever model gets picked; the migration has to match it exactly or every future migration inherits the mismatch.
- Apply the RLS policies ([DB §9](07-database-design.md)) in the same migration that creates the tables — not as a follow-up. Untested RLS is the same as no RLS.

## 2. Build Sequence

**Phase 1 — Core chat pipeline (the thing that has to work for anything else to matter)**
`/v1/chat/bootstrap` + `/v1/chat/message` ([API §2](09-api-specification.md)) end to end: classification call → retrieval → generation → SSE stream, rendered in the widget as plain text with the `ack` cue. No cards, no lead capture, no escalation yet — just: does a real question get a real, grounded answer, streamed, inside the latency budget ([AI Engine §6](10-ai-engine-specification.md))? Seed the database with one hotel's worth of hand-entered content to test against, not real ingestion yet.

**Phase 2 — Knowledge ingestion**
Upload → parse → chunk → tag → embed → validate ([IA §5](03-information-architecture.md), [Architecture §5](06-system-architecture.md)), with the admin upload screen and status badges ([UX §9](05-user-experience-flows.md)). This unblocks loading the pilot hotel's *actual* content instead of hand-entered test data — do this early, not last, so Phase 3 onward is tested against real material.

**Phase 3 — Full behavior spec**
Journey-state-driven behavior end to end: recommendation cards, relationship bundles, lead capture (with the Yes/No confirmation), escalation/handoff, CTA lifecycle-stage logic ([UX §3–6](05-user-experience-flows.md), [ABS §7–9](02-ai-behavior-specification.md)). This is where the [Playbook](04-conversation-playbook.md)'s Golden Set scenarios start getting run by hand, one by one, as each behavior lands — not saved up for the end.

**Phase 4 — Admin portal completion**
Dashboard KPI tiles, conversation review + QA scoring, leads inbox, brand settings (with live preview + contrast validation), relationship bundle builder (with live guest-card preview), analytics (topics + missing-information panel). Everything here reads data Phases 1–3 already produce — no new backend concepts, just surfaces.

**Phase 5 — Visual design system**
Apply whichever [design system option](08-ui-design-system.md) gets chosen (or combination — Option D can layer onto A/B/C). Deliberately Phase 5, not Phase 1: building against real, working behavior first means the visual layer skins something that already works, rather than skinning a mockup and discovering behavioral gaps under the polish.

**Phase 6 — QA pass and pilot prep**
Full [Playbook](04-conversation-playbook.md) run (all 60 scenarios) against the actual system prompt. Load the real pilot hotel's knowledge base in full. Fix whatever the Playbook catches. This phase ends when the [PRD §20](01-PRD-ai-concierge.md) definition of success is actually true, not assumed true.

**Parallel task, not a numbered phase — build the demo property.** The [Sales Demo Script](13-sales-demo-script.md)'s "Bellevue Hotel" needs to exist *before* the meeting with Adam, and it is not the same thing as the real pilot hotel in Phase 6 — it's a small site Devsphinx authors and hosts, with realistic (licensed/generated, not scraped) content matching the IA entity types, used to feed Phase 2's ingestion pipeline with something more convincing than hand-entered test rows. This can start as soon as Phase 2 exists and should be done well before Phase 6, since the pitch meeting doesn't wait for a real pilot hotel to be signed — it's what gets one signed.

## 3. Testing Strategy

- **The Playbook is the regression suite** ([Playbook §6](04-conversation-playbook.md)) — not a separate test framework to build. Every scenario has expected behavior; run it, score it against the [QA Rubric](02-ai-behavior-specification.md), fix what fails.
- **Deterministic logic gets real unit tests**: the confidence formula and reranking score ([AI Engine §4–5](10-ai-engine-specification.md)) are pure functions — test them directly, don't rely on end-to-end runs to catch a weighting bug.
- **RLS gets an explicit adversarial test**: attempt a cross-tenant read with a second hotel's session before Phase 1 is considered done, not assumed safe because the policy exists.
- **No new eval infrastructure** — the "Flag for Playbook" loop ([UX §11](05-user-experience-flows.md)) is how real pilot transcripts become regression tests once the pilot is live.

## 4. Definition of Done

Directly the [PRD §20](01-PRD-ai-concierge.md) criteria — repeated here because "done" should mean the same thing in this doc as it does in the one that defined the product:

- A hotel can upload its content in under 30 minutes
- Guests receive accurate answers to common questions
- The AI captures qualified leads
- Staff can review conversations and analytics
- The product is compelling enough for a pilot deployment with a real hotel

## 5. Open Risks Worth Naming Now

- **Design decision (§8a–d) is still open** — Phase 5 is blocked on it. Doesn't block Phases 1–4.
- **NestJS-on-Vercel-Functions has no prior validation in this project** — flagged as the Week 0 spike above precisely because it's the one architectural assumption nobody has actually run.
- **Embedding model dimension** must be locked before the first migration, not adjusted after.
- **Upstash free-tier ceiling** ([Architecture §8](06-system-architecture.md)) — fine for one pilot hotel; worth a quick usage check before onboarding a second.
- **Scope creep is the real risk for a solo build, not any single technical decision.** Freeze the MVP as scoped in [PRD §19](01-PRD-ai-concierge.md) until after the pilot — a mid-build "what if we also added X" is how a 6–7 sprint plan becomes indefinite.
- **UI perfectionism** — [UI Design System](08-ui-design-system.md) tokens exist, but the instinct to keep refining visuals before the behavior underneath is proven is exactly what Phase 5's placement (deliberately last, §2 above) already guards against. Use `shadcn/ui` defaults through Sprints 1–4 without apology; the polish pass has its own dedicated phase.

---

**This is the last product-design document.** [Engineering Conventions](12-engineering-conventions.md) covers repo structure and code-level hygiene, and the [Sprint Backlog](14-sprint-backlog.md) turns these six phases into the actual checkable tickets to work from — that's where day-to-day execution should live from here, not this doc or `pnpm create next-app` alone.
