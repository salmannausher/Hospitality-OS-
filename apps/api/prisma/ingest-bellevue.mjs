// Ingest the Bellevue source files through the real pipeline (Sprint 2).
// Stands in for the authed admin upload endpoint until Supabase Auth is wired:
// it boots the Nest app context, resolves the seeded Bellevue hotel, and runs
// each content file through IngestionService.ingestNow (parse → extract → chunk
// → tag → embed → write → validate). Run `nest build` first.
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { IngestionService } = require('../dist/src/knowledge/ingestion.service.js');
const { PrismaService } = require('../dist/src/common/prisma/prisma.service.js');

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});

try {
  const prisma = app.get(PrismaService);
  const ingestion = app.get(IngestionService);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Ingesting into hotel ${hotelId}\n`);

  const contentDir = join(here, 'content', 'bellevue');
  const files = readdirSync(contentDir).filter((f) => /\.(md|txt|pdf|docx)$/i.test(f));

  // Idempotent re-runs: drop any prior documents for these filenames (and their
  // chunks/jobs) before re-ingesting. Leaves the seed document untouched.
  await prisma.withTenant(hotelId, async (tx) => {
    const prior = await tx.document.findMany({
      where: { filename: { in: files } },
      select: { id: true },
    });
    const ids = prior.map((d) => d.id);
    if (ids.length) {
      await tx.$executeRawUnsafe(
        `DELETE FROM "Chunk" WHERE "documentId" = ANY($1::text[])`,
        ids,
      );
      await tx.ingestionJob.deleteMany({ where: { documentId: { in: ids } } });
      await tx.document.deleteMany({ where: { id: { in: ids } } });
    }
  });

  for (const filename of files) {
    const buffer = readFileSync(join(contentDir, filename));
    const { documentId, status } = await ingestion.ingestNow(hotelId, filename, buffer);
    console.log(`  ${filename.padEnd(32)} → ${status.padEnd(13)} (doc ${documentId})`);
  }
  console.log('\nDone.');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await app.close();
}
