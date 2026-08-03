// Verifies the durable ingestion adapters (findings-log.md #5/#40):
// BullMqIngestionQueue actually connects to the real Upstash Redis instance
// and processes a real document end to end WITHOUT the test ever calling
// runTick() itself — proving the post-enqueue best-effort tick
// (BullMqIngestionQueue.enqueue -> void this.runTick()) is what picks it up,
// the same path a guest upload would take in production. Also confirms the
// tick is idempotent/safe to call again once the queue is drained. Run
// `pnpm run build` first.
import 'dotenv/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { IngestionService } = require('./dist/src/knowledge/ingestion.service.js');
const {
  INGESTION_QUEUE,
} = require('./dist/src/knowledge/queue/ingestion-queue.js');
const {
  BullMqIngestionQueue,
} = require('./dist/src/knowledge/queue/bullmq-ingestion-queue.js');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service.js');

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

let createdDocumentId = null;
let hotelId = null;

try {
  const prisma = app.get(PrismaService);
  const ingestion = app.get(IngestionService);
  const queue = app.get(INGESTION_QUEUE);

  [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}\n`);

  check(
    'UPSTASH_REDIS_URL is set, so KnowledgeModule bound the durable BullMQ adapter',
    queue instanceof BullMqIngestionQueue,
    queue.constructor.name,
  );

  const { documentId } = await ingestion.ingestFile(
    hotelId,
    'verify-durable-ingestion.txt',
    Buffer.from(
      'The lobby closes at midnight and reopens at 6am. This document exists only to verify the durable ingestion queue and is safe to ignore/delete.',
      'utf8',
    ),
  );
  createdDocumentId = documentId;
  console.log(`Enqueued document ${documentId} via ingestFile() (real BullMQ Queue.add, not ingestNow's inline path)\n`);

  // Deliberately NOT calling queue.runTick() here — the whole point is to
  // prove enqueue()'s own best-effort tick (or, failing that, the Vercel
  // Cron sweep this test can't simulate) picks the job up on its own. Real
  // processing (parse/extract/chunk/tag/embed/validate, each a real AI
  // Gateway or Voyage round trip) measured ~27s via ingestNow's direct path
  // in this environment — 90s leaves comfortable margin instead of racing it.
  let finalStatus = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const doc = await prisma.withTenant(hotelId, (tx) =>
      tx.document.findUniqueOrThrow({ where: { id: documentId } }),
    );
    if (doc.status !== 'PARSING') {
      finalStatus = doc.status;
      break;
    }
    await sleep(2000);
  }

  check(
    'Document left PARSING within 90s with no manual runTick() call — the post-enqueue best-effort tick processed it',
    finalStatus !== null,
    finalStatus ?? 'still PARSING after 90s',
  );
  check(
    'Final status is a real terminal state (INDEXED/NEEDS_REVIEW/FAILED), not stuck mid-pipeline',
    ['INDEXED', 'NEEDS_REVIEW', 'FAILED'].includes(finalStatus),
    finalStatus,
  );

  // Only now — once polling confirms the queue is genuinely idle, not mid-job
  // — is "does a tick on a drained queue return quickly" a meaningful check.
  // Asserting this immediately after enqueue would be racing the first tick's
  // own in-flight job, which is exactly what an earlier version of this
  // script did and incorrectly read as a bug.
  const tickStart = Date.now();
  const drainedTick = await queue.runTick();
  const tickMs = Date.now() - tickStart;
  check(
    'A tick against a genuinely idle queue returns quickly (bounded sweep, not an open listener)',
    tickMs < 5000,
    `${tickMs}ms, ${JSON.stringify(drainedTick)}`,
  );

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  try {
    if (createdDocumentId && hotelId) {
      const prisma = app.get(PrismaService);
      // Soft delete, matching this schema's own convention (Document.deletedAt)
      // — a hard delete would hit the (intentionally un-cascaded) Chunk/
      // IngestionJob FK references this same run created.
      await prisma.withTenant(hotelId, (tx) =>
        tx.document.update({
          where: { id: createdDocumentId },
          data: { deletedAt: new Date() },
        }),
      );
    }
  } finally {
    await app.close();
  }
}

process.exit(failures === 0 ? 0 : 1);
