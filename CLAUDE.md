# Hospitality AI OS — AI Concierge

Read [docs/README.md](docs/README.md) before writing any code. It indexes 15 documents — PRD through the Prompt Library implementation prompts — that already answer almost every design question this project has. **Never invent architecture, a data model, an API shape, or a behavior rule that already exists in `docs/`.** If something genuinely isn't decided yet, say so explicitly rather than guessing — and check [docs/README.md](docs/README.md)'s "Status" section first, since it names the one thing still genuinely open (the UI Design System choice, [08a–d](docs/08-ui-design-system.md)).

## Decisions already made — don't re-litigate or default around these

- **Model:** Claude via the AI Gateway, **not** OpenAI. **Embeddings:** Voyage AI, **not** `text-embedding-3-small`. ([Architecture §7](docs/06-system-architecture.md), [AI Engine §1](docs/10-ai-engine-specification.md))
- **Auth:** Supabase Auth issues all credentials end to end. There is no custom `/auth/login`, no app-issued access/refresh token pair, no password ever touches our database. ([API §3.1](docs/09-api-specification.md), [DB §1](docs/07-database-design.md))
- **Deployment:** single-platform Vercel (Fluid Compute), **not** Railway/Fly, **not** Docker. NestJS runs behind a single catch-all Vercel Function. ([Architecture §8](docs/06-system-architecture.md))
- **Queue:** Upstash Redis + BullMQ, **not** Vercel Queues (revisit only once Vercel Queues is GA and the swap is genuinely cheap — it's behind an interface for exactly this reason). ([Architecture §8](docs/06-system-architecture.md))
- **Multi-tenancy:** Postgres row-level security keyed on `hotelId`, set server-side per request — never a client-supplied tenant id, never a query that skips the filter. ([DB §9](docs/07-database-design.md))
- **Roles:** `SUPER_ADMIN | AGENCY_ADMIN | HOTEL_ADMIN | MARKETING | RESERVATIONS | VIEWER` — exactly these six, nothing else. ([DB §3](docs/07-database-design.md))
- **Testing:** the [Playbook](docs/04-conversation-playbook.md) is the end-to-end regression suite; unit tests are for the deterministic pure functions specifically (confidence formula, rerank score). No blanket coverage target, no separate eval framework to build.

## How to work in this repo

- **Modular monolith** — `apps/web` (Next.js), `apps/api` (NestJS), shared `packages/{ui,types,prompts,sdk,config}`. Not microservices. ([Architecture §3](docs/06-system-architecture.md), [Engineering Conventions §2](docs/12-engineering-conventions.md))
- **API-first** — the frontend calls the backend only through `packages/sdk`, matching [API Specification](docs/09-api-specification.md) exactly. Never a direct Prisma call from a Next.js page.
- **Work off [docs/14-sprint-backlog.md](docs/14-sprint-backlog.md)**, not the more abstract phase descriptions in the Development Plan — it's the live checklist; check boxes off as work completes, don't just read it.
- **For the prompt library specifically**, use [docs/15-prompt-library-implementation-prompts.md](docs/15-prompt-library-implementation-prompts.md) directly — it's already broken into ready-to-run, self-contained tasks.
- **Before generating code for a ticket:** state the plan and which doc section(s) it implements. **After generating:** state what was created and where. **Output complete files, never partial implementations.**
- **No duplicated business logic.** If a rule (grounding, escalation, lead-capture signals) needs to apply in more than one place, it lives once — in `packages/prompts/base.md` or the relevant shared module — and gets referenced, never re-typed.
- **Every ticket's Definition of Done** is the standing checklist in [Sprint Backlog — "Per-Ticket Definition of Done"](docs/14-sprint-backlog.md), regardless of which sprint it's in.

## Housekeeping

- Run a **weekly refactor pass**: duplicated code, files that have grown too large, dead imports, drift from the module boundaries above. Suggest improvements; don't rewrite unless the drift is real.
- **Bug fixes:** identify root cause and affected modules before patching, fix without breaking the architecture above, preserve API compatibility, return only the modified files.
- **Git:** PR-only merges, even solo — see [Engineering Conventions §8](docs/12-engineering-conventions.md).
