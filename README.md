# Hospitality AI OS — AI Concierge

Read [CLAUDE.md](CLAUDE.md) and [docs/README.md](docs/README.md) before touching anything here — this repo is implemented directly from fifteen planning documents, not improvised, and both files exist specifically so nobody (human or AI) has to re-derive a decision that's already made.

## Structure

```
apps/
  web/      Next.js 16 — guest widget + admin portal
  api/      NestJS 11 — modular monolith, single Vercel Function
packages/
  types/    Shared TypeScript types (SSE events, enums matching the Prisma schema)
  prompts/  The Prompt Library — base template + composable modules + classifier
  sdk/      The only way apps/web calls apps/api
  ui/       Component library (empty until the design-system decision lands)
  config/   Shared tsconfig/lint config
docs/       Product, architecture, and API specs — see docs/README.md
```

## Getting started

```bash
nvm use            # Node 24, per .nvmrc
cp .env.example .env
cp .env.example apps/api/.env   # fill in real values in both — see docs/12 §7
pnpm install
pnpm --filter api exec prisma generate
```

`apps/api/prisma/rls-policies.sql` documents the row-level security policies to apply after the first `prisma migrate dev` — see the comment at the top of that file for the exact commands.

## Where things actually are

- **What to build and why:** [docs/README.md](docs/README.md)
- **What to build next, checkbox by checkbox:** [docs/14-sprint-backlog.md](docs/14-sprint-backlog.md)
- **AI Behavior Specification:** [docs/02](docs/02-ai-behavior-specification.md)
- **Database schema (source of truth is `apps/api/prisma/schema.prisma`, reasoning is here):** [docs/07](docs/07-database-design.md)
