// Prisma 7 config — connection settings live here, not in schema.prisma.
// Actual runtime PrismaClient instantiation additionally requires a driver
// adapter (@prisma/adapter-pg) — added when the real DATABASE_URL exists
// (Sprint 0, docs/14-sprint-backlog.md), not needed for schema validation.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
