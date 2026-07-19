// Prisma 7 config — connection settings live here, not in schema.prisma.
//
// Two URLs, deliberately: DIRECT_URL (port 5432, no pooler) is what the
// Prisma CLI uses here for migrations — Supabase's transaction pooler
// doesn't support the DDL/prepared-statement patterns migrations need.
// DATABASE_URL (port 6543, Supavisor transaction pooler) is what the
// *runtime* PrismaClient uses via the @prisma/adapter-pg driver adapter
// (Sprint 1, docs/14-sprint-backlog.md) — serverless functions can spin up
// many concurrent instances, and without pooling that exhausts Postgres's
// connection limit fast (Architecture §8's scaling note, made concrete).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
