# System Architecture Blueprint

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [AI Behavior Specification](02-ai-behavior-specification.md) · [Information Architecture](03-information-architecture.md) · [Conversation Playbook](04-conversation-playbook.md) · [User Experience Flows](05-user-experience-flows.md)

Every prior document defined a contract this system has to honor: the ABS's confidence bands and escalation triggers, the IA's retrieval pipeline and multi-tenant isolation, the UX doc's streaming/handoff/upload states. This document is where those contracts become actual services, data flow, and API boundaries — mostly consolidation of decisions already implied elsewhere, plus the handful of concrete infrastructure calls that were left open.

---

## 1. Scope

This is a blueprint, not the [Database Design](07-database-design.md) doc — table-level schema, indexes, and migrations are covered there. Here we fix: service boundaries, request flow for the two things this system actually does (answer a guest, ingest knowledge), data stores, multi-tenancy enforcement point, and deployment topology.

## 2. High-Level Topology

```
                    ┌─────────────────────┐
                    │   Guest Widget       │  (embedded on hotel site, UX §2)
                    │   Admin Portal       │  (UX §8)
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Public Chat API    │  unauthenticated, hotel-scoped
                    │   Admin API          │  authenticated, role-gated
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
   ┌──────────▼──────┐  ┌──────▼───────┐  ┌─────▼──────────┐
   │  Chat            │  │  Ingestion    │  │  Analytics /    │
   │  Orchestrator     │  │  Worker       │  │  Eval Service   │
   │  (§4)             │  │  (§5)         │  │  (§9)           │
   └──────────┬──────┘  └──────┬───────┘  └─────┬──────────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Postgres + pgvector │  tenant-scoped (§6)
                    │  Object Storage       │  raw documents
                    │  Queue (§8)           │  async ingestion jobs
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  AI Gateway          │  model routing (§7)
                    │  → Claude, embeddings │
                    └─────────────────────┘
```

Four logical services, not necessarily four deployments (see §8 on why this collapses to one platform for MVP):

- **Chat Orchestrator** — the pipeline in §4; the only thing the guest widget talks to.
- **Ingestion Worker** — the pipeline in [IA §5](03-information-architecture.md), running async off the upload request.
- **Admin API** — CRUD for everything in the [Admin Portal](05-user-experience-flows.md) (hotels, knowledge, brand, prompts, users, leads).
- **Analytics/Eval Service** — powers the [Analytics screen](05-user-experience-flows.md) and the [Playbook](04-conversation-playbook.md)'s "flag for playbook" loop.

## 3. Service Boundaries & APIs

| Boundary | Auth | Consumers | Notes |
|---|---|---|---|
| `POST /chat/message` | Public, but scoped by a per-hotel widget key + rate limit | Guest Widget | Streaming response (SSE/chunked). Never accepts a raw `hotel_id` from the client — resolved server-side from the widget key to prevent tenant spoofing. |
| `POST /chat/lead` | Same as above | Guest Widget | Fires on the Yes/No + field-capture flow ([UX §4](05-user-experience-flows.md)); idempotent per session. |
| `/admin/*` | Session auth, role-gated ([PRD §16](01-PRD-ai-concierge.md)) | Admin Portal | Standard authenticated CRUD — hotels, knowledge documents, relationships, conversations, leads, brand, prompts, users. |
| `/admin/knowledge/upload` | Authenticated | Admin Portal | Returns immediately with a job id; actual processing happens in the Ingestion Worker (§5), status polled/streamed back to the [upload UI](05-user-experience-flows.md). |
| Internal: Chat Orchestrator → Retrieval | n/a (in-process or internal RPC) | — | Not guest- or admin-facing; exists so the retrieval logic in [IA §7](03-information-architecture.md) is one implementation shared by chat, not duplicated. |

**These are logical boundaries, not separate deployments — a modular monolith, not microservices.** At one-pilot-hotel scale, independent scaling and independent failure domains don't pay for themselves yet, and every service boundary is a place a contract can silently drift, which costs more (for a solo developer, and for an AI coding agent working across the codebase) than it saves. Concretely, this is one NestJS app with module boundaries matching the sections above, not four deployed services:

```
apps/
 ├── web   (Next.js — guest widget + admin portal)
 └── api   (NestJS)
      src/
       ├── auth/
       ├── hotels/            (tenancy, brand settings, widget keys — §6)
       ├── knowledge/         (documents, chunks, entities, ingestion — §5)
       ├── conversations/     (chat orchestrator — §4)
       ├── ai/                (AI Gateway calls, retrieval, confidence scoring — §7)
       ├── leads/
       ├── analytics/
       ├── playbook/          (QA scoring, scenario flagging)
       └── common/            (RLS session-context middleware, shared types)
```

If a specific module later needs independent scaling (the Ingestion Worker's CPU profile is the most likely candidate — §5, §8), that's a well-scoped extraction to do once there's a measured reason, not a default to build in now on guesswork.

This `apps/` layout is extended with a shared `packages/` layer (UI components, generated types, the prompt library, a typed API client) in [Engineering Conventions §2](12-engineering-conventions.md) — the full monorepo structure lives there, not duplicated here.

**NestJS on Vercel Functions — verified zero-configuration, not a custom adapter.** Corrected after the Sprint 0 spike (docs/14-sprint-backlog.md): earlier drafts of this document assumed a hand-wired serverless adapter was needed to run NestJS on Vercel. As of the current platform, it isn't — Vercel detects a standard NestJS entrypoint (`src/main.ts`, unmodified: `NestFactory.create(AppModule)` then `app.listen(...)`) and deploys the whole app as a single Vercel Function on Fluid Compute automatically, with no custom handler code. The scaffolded `apps/api/src/main.ts` already matches this convention exactly — nothing to change. Fluid Compute's instance reuse (§8) still supplies the "bootstrap once, not per request" benefit; it's just automatic now rather than something we build. Keeping NestJS (rather than a lighter framework) doesn't require falling back to a separate Railway/Fly backend deployment; the single-platform decision in §8 still holds — on firmer footing than when this was written, if anything.

## 4. Request Flow — Guest Message

This is the concrete pipeline behind [IA §7](03-information-architecture.md) and [ABS §14](02-ai-behavior-specification.md), with every stage owned by a named module rather than left implicit:

```
Guest message arrives (POST /chat/message)
        │
        ▼
1. Tenant resolution — widget key → hotel_id (never trust client-supplied id)
        │
        ▼
2. Journey-state classification (ABS §16) — information / planning /
   booking_intent / service_recovery — runs BEFORE topical intent,
   since service_recovery overrides everything downstream
        │
        ▼
3. Topical intent / domain classification (ABS §17)
        │
        ▼
4. Query rewrite — resolve pronouns/context from session history (ABS §11)
        │
        ▼
5. Retrieval (IA §7) — domain-filtered hybrid search + entity lookup +
   relationship-bundle lookup if a context_tag/persona is set (IA §12,
   including from the quick-start selector, UX §2)
        │
        ▼
6. Confidence scoring (ABS §5) — High / Medium / Low band
        │
        ▼
7. Response generation — system prompt template (ABS §14) assembled with
   retrieved context + conversation history, sent through the AI Gateway (§7)
        │
        ▼
8. Side-effect resolution (parallel, not blocking the stream):
     - Recommendation card selection (UX §3)
     - Lead-capture signal check (ABS §8)
     - Escalation trigger check (ABS §7) — if service_recovery fired in
       step 2, this is already decided, not re-evaluated here
        │
        ▼
9. Stream tokens to widget; log turn (intent, journey_state, confidence,
   escalation flag, lead-capture flag) for Analytics (§9) and QA (ABS §15)
```

**Why step 2 runs before step 3:** a Service Recovery message ("the AC isn't working") and a routine dining question can share vocabulary, but everything downstream — retrieval scope, whether a recommendation card is even eligible to render, whether the response is generated by the model at all versus going straight to the escalation panel — depends on getting this ordering right. This is the architectural expression of [Playbook §16](04-conversation-playbook.md)'s rule that Service Recovery overrides every other behavior.

## 5. Request Flow — Knowledge Ingestion

Maps directly to [IA §5](03-information-architecture.md); the architectural addition here is making it explicitly asynchronous so a large PDF upload doesn't block the admin UI:

```
Admin uploads document → Admin API stores raw file (object storage),
enqueues an ingestion job, returns job id immediately
        │
        ▼
Ingestion Worker picks up job:
  parse → entity extraction → chunk → domain tagging → embed → validate
        │
        ▼
Status written back per document: Indexed / Needs Review / Failed
(polled or pushed to the Knowledge Upload UI, UX §9)
```

The worker is stateless and horizontally scalable — re-indexing a hotel's entire knowledge base (e.g., after a chunking-strategy change) is the same code path as a single upload, just enqueued in bulk.

## 6. Multi-Tenant Isolation — Enforcement Point

[IA §8](03-information-architecture.md) already states the rule (row-level security, hard predicate not a post-filter). Architecturally, this means:

- Every database connection used by the Chat Orchestrator and Admin API sets the tenant context (`hotel_id`) at the start of the request, and Postgres row-level security policies enforce it at the query layer — application code cannot accidentally bypass the filter by forgetting a `WHERE` clause, because the database itself refuses cross-tenant rows.
- The public Chat API's tenant resolution (§4, step 1) is the *only* place a `hotel_id` is derived from untrusted input (the widget embed key), and that resolution is a signed/looked-up mapping, never a client-supplied value.
- The Admin API's tenant scoping additionally depends on the authenticated user's role ([PRD §16](01-PRD-ai-concierge.md)) — an Agency Admin's session can carry multiple `hotel_id`s in scope, a Hotel Admin's exactly one.

## 7. AI / Model Layer

- **Model routing goes through the AI Gateway**, not a hardcoded provider SDK call. This gives model fallback, cost/usage observability per hotel (useful for the pricing model in the PRD's business case), and zero-data-retention configuration in one place, rather than re-implementing provider-switching logic in the orchestrator.
- **Primary model:** Claude, called as a `"provider/model"` string through the gateway — this is also what makes swapping in a cheaper/faster model for lower-stakes classification steps (journey-state, intent) versus the main response-generation call a config change, not a code change.
- **Embeddings:** Voyage AI, as already specified in the [PRD](01-PRD-ai-concierge.md)'s tech stack — a separate, cheaper call path from the main conversational model, run at ingestion time (§5) and query time (retrieval, §4 step 5).
- **Confidence scoring (ABS §5)** is computed from retrieval signals (chunk similarity, agreement across chunks) and intent-classifier certainty — it is not something asked of the generation model itself (a model narrating its own confidence is a weaker signal than the retrieval math that already exists in the pipeline).

## 8. Data Stores & Deployment Topology

| Store | Purpose | Notes |
|---|---|---|
| Postgres + pgvector | Tenant-scoped relational data (hotels, users, leads, conversations) + entity tables ([IA §3](03-information-architecture.md)) + chunk embeddings | Row-level security per §6. Schema detail is the next document (Database Design). |
| Object storage | Raw uploaded documents (PDFs, DOCX) | Signed uploads only ([PRD §15](01-PRD-ai-concierge.md)). |
| Queue | Async ingestion jobs (§5) | Upstash Redis + BullMQ, accessed only through an internal interface — see decision below (revised from an earlier Vercel Queues default, on cost/maturity grounds). |

**Deployment decision:** single-platform. Next.js frontend + Chat/Admin APIs run as Vercel Functions with Fluid Compute, superseding the PRD's original Railway/Fly.io split — Fluid Compute's warm-instance reuse directly helps the "<2s response start" NFR, and one platform beats two for a small team on a 3-week pilot clock, regardless of eventual scale (see below).

**Queue choice, revised:** the ingestion pipeline runs on **Upstash Redis + BullMQ** rather than Vercel Queues, called through a small internal interface — `enqueue(job)` / `consume(job)` — rather than importing either SDK directly inside the pipeline logic (parse → extract → chunk → tag → embed → validate, already fully spec'd in [IA §5](03-information-architecture.md) and platform-agnostic). This is a direct result of the cost pass: Upstash has a real, known, generous free tier and BullMQ is mature production tooling, whereas Vercel Queues is still public beta with pricing not yet fully published — for a solo developer on a near-zero budget, "known and free" beats "unknown and maybe-cheaper-later." Behind the interface, swapping to Vercel Queues once it's GA (or if Upstash's free tier is ever actually outgrown) is a one-module change, not a rewrite — the abstraction is what makes either starting choice low-regret.

**Long-term scaling note.** If this succeeds and grows toward the PRD's "1,000+ hotels" target, the compute-platform choice made here is not where it breaks first:

- **Postgres connection pooling and multi-tenant query/index performance** (pgvector across a large multi-tenant embedding table) is the actual bottleneck at that scale — a Database Design problem (see [Database Design](07-database-design.md)), and identical regardless of which compute platform runs the API.
- **Upstash's free tier has real request/bandwidth ceilings** that a growing platform will eventually cross — the interface guardrail above is what keeps that transition (to a paid Upstash tier, or to Vercel Queues, whichever is cheaper/more mature by then) a config change instead of a rewrite.

**Hosting tier note — the one place "free" has a real ceiling worth naming now.** Vercel's Hobby (free) plan is explicitly non-commercial per its terms — fine while building and privately demoing to Adam, but the moment this is deployed on a real hotel's live site serving real guests, that's commercial use and needs **Vercel Pro (~$20/month)**. Budget for that transition explicitly rather than discovering it mid-pilot: realistically, dev/demo stage runs near-$0 beyond AI API usage, and the moment a pilot hotel goes live the floor becomes roughly Pro ($20) + AI usage (~$10–20) + domain (~$1–2/month amortized) — call it **$30–45/month** once live, not the "$12–22/month" figure that only holds pre-launch.
- **Vendor lock-in only matters if Devsphinx's ambitions outgrow Spherical** — the "sell this independently" optionality discussed earlier in this project. That's a business bet to revisit if it becomes real, not a reason to pay for a split deployment today.
- Everything else about a single-platform Vercel deployment is genuinely built for this scale (native Node backend support, Fluid Compute, generous function timeouts) — staying on one platform is arguably a bigger operational win at scale for a small team than at pilot size, since it's one less thing to keep in sync while everything else (support, content curation, sales) scales with hotel count.
- **Cost** (Active CPU pricing vs. a fixed dedicated worker) should be modeled from real pilot usage data once it exists, not decided blind now.

## 9. Observability & the Analytics/Eval Service

- **Every chat turn is logged** with its journey_state, domain/intent, confidence band, escalation flag, and lead-capture flag (§4, step 9) — this structured log is what powers both the [Analytics "Missing Information" panel](05-user-experience-flows.md) (Low-Confidence turns, aggregated by domain) and the [QA Rubric](02-ai-behavior-specification.md) scoring in Conversation Review.
- **Application errors and latency:** standard error tracking (Sentry) and product analytics (PostHog) as specified in the [PRD](01-PRD-ai-concierge.md)'s tech stack — these are for system health, distinct from the conversation-quality logging above.
- **The "Flag for Playbook" action** ([UX §11](05-user-experience-flows.md)) writes a new row into the same schema the [Playbook](04-conversation-playbook.md) already defines (§2) — there is deliberately no separate "eval system" data model; the playbook's scenario schema *is* the eval schema.

## 10. Security Notes (see also PRD §15)

- Public Chat API: rate-limited per widget key, no PII accepted beyond what the Lead Capture flow explicitly requests, no endpoint that returns another tenant's data under any input.
- Admin API: role-gated per [PRD §16](01-PRD-ai-concierge.md); audit-logged for anything that touches brand settings, prompts, or knowledge (a hotel's concierge behavior changing is exactly the kind of action that needs a trail).
- Secrets (model API keys, embedding provider keys) live in the deployment platform's environment/secret management, never in the database or client-visible config — the widget key used for tenant resolution (§6) is a public-but-scoped identifier, not a secret.

## 11. Non-Functional Requirements — Where They're Satisfied

Ties back to [PRD §17](01-PRD-ai-concierge.md) rather than restating them:

| NFR | Satisfied by |
|---|---|
| Chat response starts < 2s | Fluid Compute warm-instance reuse (§8) + streaming from step 7 of §4, not waiting for full generation |
| 99.9% uptime | Platform SLA (Vercel + managed Postgres) + stateless orchestrator/worker design (§4, §5) with no single in-process state to lose |
| Scalable to 1,000+ hotels | Tenant-scoped queries as a hard predicate (§6), stateless horizontally-scalable ingestion worker (§5) |
| Mobile responsive | Owned by the frontend, not this doc — see [UX §1](05-user-experience-flows.md) |

## 12. Deliberately Out of Scope Here

Consistent with [PRD §19](01-PRD-ai-concierge.md)'s MVP scope: no booking-engine/PMS integration, no payment processing, no voice pipeline, no multi-language routing beyond the `language` field already reserved in the chunk schema ([IA §11](03-information-architecture.md)). This blueprint is sized to what's actually being built for the pilot, not the full V2–V4 roadmap.

---

**Next document:** [Database Design](07-database-design.md) — Prisma schema, ERD, and indexes for the entities and relationships this blueprint references at a conceptual level.
