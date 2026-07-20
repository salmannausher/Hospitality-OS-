# Engineering Conventions

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [System Architecture](06-system-architecture.md) · [API Specification](09-api-specification.md) · [Development Plan](11-development-plan.md)

Every prior document specifies *what* the system does. None of them specify how the codebase itself stays consistent as it's written — naming, state management, git hygiene, what gets logged. This is that document: the conventions Claude Code (or any engineer) should already be following before writing the first line, not discovering ad hoc three files in.

---

## 1. Engineering Principles

Seven rules, most of which this project already follows implicitly across earlier docs — stated explicitly here so they're a gut-check, not tribal knowledge:

1. **Simplicity over cleverness.** Readable code wins — consistent with [Architecture §3](06-system-architecture.md)'s modular-monolith-over-microservices reasoning: a solo developer and an AI coding agent both pay a real cost for complexity that doesn't earn its keep yet.
2. **Configuration over customization.** A hotel's behavior changes through `BrandSettings`, `PromptOverride`, and `EntityRelationship` rows ([DB Design](07-database-design.md)) — never a forked code path per hotel. This has been true in every doc since the IA; naming it as a principle here makes it a rule to check new work against, not just a pattern that happened to emerge.
3. **Modular monolith first.** Already decided in [Architecture §3](06-system-architecture.md) — restated here because it governs day-to-day code organization (§2 below), not just deployment topology.
4. **Type safety everywhere.** TypeScript end-to-end, Prisma-generated types as the source of truth — no hand-maintained type duplicating a schema that already exists.
5. **API-first.** The frontend talks to the backend only through the contracts in the [API Specification](09-api-specification.md) — never a direct Prisma call from a Next.js page. This is what keeps the SSE event-driven design ("server drives, widget renders," [API §2.1](09-api-specification.md)) actually enforced in practice.
6. **Observability by default.** See §6 — every important event is logged, guest content is not.
7. **Security by default.** Tenant isolation ([DB §9](07-database-design.md)), input validation (§5), and rate limiting ([API §4](09-api-specification.md)) are not follow-up hardening — they exist from the first migration and the first route.

## 2. Monorepo Structure

[Architecture §3](06-system-architecture.md) specified `apps/web` and `apps/api`. This extends it with the shared-package layer that structure was missing — the thing that keeps frontend and backend from drifting apart as both grow:

```
hospitality-ai-os/
├── apps/
│   ├── web/              # Next.js — guest widget + admin portal (UX Flows, UI Design System)
│   └── api/               # NestJS — modules per Architecture §3 / API §4
├── packages/
│   ├── ui/                 # Shared components — the chosen UI Design System, built once
│   ├── types/              # Shared TS types, generated from the Prisma schema — never hand-duplicated
│   ├── prompts/             # Base template + composable domain/persona modules + classifier + entity-extraction prompts — the full library, [AI Engine §3](10-ai-engine-specification.md)
│   ├── sdk/                # Typed API client generated from the API Specification — the only way `web` calls `api`
│   └── config/              # Shared ESLint/TSConfig
├── docs/
└── scripts/
```

**Why `packages/prompts` earns its own package rather than living inline in the `ai/` module:** the [ABS system prompt template](02-ai-behavior-specification.md) and the [Playbook](04-conversation-playbook.md) both need to reference the exact same prompt text — the playbook is testing what the prompt actually says, not a paraphrase of it. A separate package makes that one source of truth instead of a template string copy-pasted into a test file. **Why `packages/sdk`:** it's the concrete mechanism behind Principle 5 — if the frontend can only reach the backend through a generated typed client, "API-first" stops being a convention people can forget and becomes something the build fails on if violated.

## 3. Naming Conventions

Consistent, non-abbreviated, across the whole monorepo:

| Kind | Pattern | Examples |
|---|---|---|
| Components | `PascalCase.tsx` | `MessageThread.tsx`, `RecommendationCard.tsx`, `RelationshipBundleBuilder.tsx` |
| Hooks | `useX()` | `useChat()`, `useKnowledgeUpload()`, `useHotelBranding()` |
| Services (NestJS) | `x.service.ts` | `chat.service.ts`, `lead.service.ts`, `ingestion.service.ts` |
| DTOs | `x.dto.ts` | `send-message.dto.ts`, matching [API spec](09-api-specification.md) request shapes 1:1 |

Component and hook names should read as what a person recognizes on screen (`MessageThread`, not `ChatDataRenderer`) — the same "name things by what people recognize" rule the [artifact-design](08-ui-design-system.md) copy guidance already applies to UI text applies to code, too.

## 4. Frontend State Management

Three tools, three jobs, deliberately not more:

- **Server state → React Query.** Everything that comes from the API (conversations, leads, knowledge documents) — caching, revalidation, and loading states are React Query's job, not hand-rolled `useEffect` fetching.
- **Session/user state → React Context.** Auth session, current hotel scope (for multi-hotel Agency Admins) — small, infrequently-changing, genuinely global.
- **Everything else → local component state.** Widget input text, form fields mid-edit, UI toggles.
- **No Redux/Zustand in V1.** Nothing in this product's data shape needs cross-cutting client state complex enough to justify it — revisit only if a real case for it shows up, not preemptively (the same "don't build for scale you don't have yet" reasoning as [Architecture §8](06-system-architecture.md)'s deployment decision).

## 5. Validation

Every request is validated twice, at two different layers, for two different reasons — client-side for UX (fast, friendly errors before a request is even sent), server-side because the client can never be trusted:

```
Client (React Hook Form + Zod schema)
        │  fast feedback, matches the API DTO shape
        ▼
API (NestJS DTO validation, the same effective schema)
        │  the actual security boundary
        ▼
Database (Prisma + RLS)
```

**Addition to the established stack:** React Hook Form + Zod, for exactly this pattern — not previously named anywhere (the stack decisions live in [Architecture §7–8](06-system-architecture.md), which covered the AI/data layer but never the frontend form-handling layer). No raw client input reaches Prisma unvalidated; this is what makes [API §1](09-api-specification.md)'s error envelope (`422` with a named code) something that actually fires reliably rather than an aspiration.

## 6. Logging — What, and What Not To

Extending [Architecture §9](06-system-architecture.md)'s per-turn conversation logging with the operational event list and the privacy rule that was missing from it:

**Log:** user login, document upload + ingestion outcome, every AI call with its latency ([AI Engine §1](10-ai-engine-specification.md)'s call inventory — this is what makes the cost/latency numbers in that doc verifiable against reality instead of theoretical), lead creation, escalation, all errors.

**Do not log guest message content** in general-purpose application logs (Sentry, PostHog, plain server logs) — it lives exactly once, in the `Message` table ([DB Design](07-database-design.md)), governed by that table's own access controls and RLS, not copied into a second, less-controlled place. This is the concrete implementation of [PRD §15](01-PRD-ai-concierge.md)'s "GDPR readiness" line, which had never been operationalized into an actual rule until now.

**Optional addition for AI-specific observability:** Langfuse (or equivalent LLM tracing tool) for prompt/completion/cost tracing per call — distinct from Sentry (app errors) and PostHog (product analytics) in that it's specifically built to inspect the [AI Engine](10-ai-engine-specification.md)'s call inventory in production. Not required for the pilot; worth adopting the moment prompt debugging in production becomes a recurring need.

## 7. Environment Variables

```
DATABASE_URL=                # app_role, pooled (port 6543) — runtime queries, RLS-restricted (DB §9)
DIRECT_URL=                  # postgres role, session pooler (port 5432) — migrations only
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AI_GATEWAY_API_KEY=          # Claude + fallback routing — Architecture §7
VOYAGE_API_KEY=               # embeddings — AI Engine §1
UPSTASH_REDIS_REST_URL=      # matches @upstash/redis's actual expected var names, not a generic guess
UPSTASH_REDIS_REST_TOKEN=
POSTHOG_KEY=
SENTRY_DSN=
```

No secrets in code, no secrets in the database — all provider keys live in the deployment platform's secret management ([Architecture §10](06-system-architecture.md)).

## 8. Git Workflow

```
main
develop
feature/<short-description>
```

**Merge only through pull requests — even solo.** This isn't process for its own sake: a PR is a natural checkpoint to actually re-read a diff before it lands, which matters at least as much when the diff was written by an AI coding agent as when it was written by hand.

**Husky pre-commit hook** running lint + typecheck, and **Commitlint** enforcing a conventional-commit message format — cheap to set up once in Sprint 0 ([Sprint Backlog](14-sprint-backlog.md)), and it's what makes "lint passes" in the per-ticket Definition of Done ([Sprint Backlog](14-sprint-backlog.md)) something the tooling catches rather than something to remember by hand.

## 9. Coding Standards

One responsibility per module/class, functions kept short where it doesn't force artificial splitting, composition over inheritance, no duplicated business logic (if the same rule appears in two places, one of them is wrong), every public API endpoint validated (§5), core logic covered by unit tests per [Development Plan §3](11-development-plan.md)'s testing strategy — the deterministic pieces (confidence formula, reranking score) especially, since those are exactly the functions correctness bugs hide in silently.

## 10. One Deliberate Divergence, Named

The stack above overlaps almost entirely with what [Architecture §7–8](06-system-architecture.md) already established, with one exception worth stating rather than silently ignoring: **this project uses Claude via the AI Gateway and Voyage AI embeddings** ([Architecture §7](06-system-architecture.md), [AI Engine §1](10-ai-engine-specification.md)) — not OpenAI's Responses API or `text-embedding-3-small`. That's an already-made, deliberate choice, not an oversight to reconcile.

---

**See also:** [Development Plan](11-development-plan.md) · [documentation index](README.md)
