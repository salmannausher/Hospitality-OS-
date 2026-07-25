// Sprint 3 follow-up — verify the fix for the Golden Set G-05 finding
// (docs/sprint-3-golden-set-run.md, finding 1): the `card` event and the
// generated answer text used to be able to name different entities in the
// same turn. Fix: the relationship bundle is now resolved BEFORE generation
// and injected into the system prompt as a "you must recommend exactly
// these" instruction (apps/api/src/ai/chat.service.ts). This reproduces the
// exact G-05 scenario that exposed the bug and confirms the text now stays
// consistent with the card.
// Run `pnpm run build` first.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { ChatService } = require('./dist/src/ai/chat.service.js');
const { GatewayService } = require('./dist/src/ai/gateway.service.js');
const { EmbeddingsService } = require('./dist/src/ai/embeddings.service.js');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service.js');

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function collect(chat, params) {
  const events = [];
  for await (const event of chat.streamTurn(params)) events.push(event);
  return events;
}

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

try {
  const prisma = app.get(PrismaService);
  const chat = app.get(ChatService);
  const gateway = app.get(GatewayService);
  const embeddings = app.get(EmbeddingsService);
  const realClassify = gateway.classify.bind(gateway);
  const realEmbedQuery = embeddings.embedQuery.bind(embeddings);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');

  const [{ embedding: chunkEmbeddingText }] = await prisma.withTenant(
    hotelId,
    (tx) => tx.$queryRaw`SELECT embedding::text AS embedding FROM "Chunk" LIMIT 1`,
  );
  const stubVector = chunkEmbeddingText.slice(1, -1).split(',').map(Number);
  console.log(`Using hotel ${hotelId}\n`);

  gateway.classify = async () => ({
    classification: {
      journeyState: 'planning',
      domain: ['spa', 'accommodation', 'dining'],
      persona: null,
      rewrittenQuery: "We're celebrating our 10th anniversary — any recommendations?",
      detectedSignals: {
        occasion: 'anniversary',
        leadCaptureWorthy: false,
        explicitHandoffRequest: false,
        lifecycleStage: 'researching',
      },
    },
    degraded: false,
  });
  embeddings.embedQuery = async () => stubVector;

  let events;
  try {
    events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "We're celebrating our 10th anniversary — any recommendations?",
    });
  } finally {
    gateway.classify = realClassify;
    embeddings.embedQuery = realEmbedQuery;
  }

  const answer = events.filter((e) => e.type === 'delta').map((e) => e.text).join('');
  const cardEvent = events.find((e) => e.type === 'card');
  console.log(`CONCIERGE: ${answer}\n`);
  console.log(`CARD: ${JSON.stringify(cardEvent)}\n`);

  check('card event fires with the real seeded anniversary bundle (3 entities)', cardEvent?.cards?.length === 3, JSON.stringify(cardEvent?.cards?.map((c) => c.title)));

  const cardTitles = (cardEvent?.cards ?? []).map((c) => c.title);
  for (const title of cardTitles) {
    check(`generated text mentions the card entity "${title}"`, answer.includes(title), '');
  }

  // The specific bug this reproduces: previously the text named "The Terrace"
  // (a real restaurant, but NOT the one in this bundle) instead of "The
  // Rooftop at Bellevue" (the actual bundled restaurant).
  const bundledRestaurant = cardTitles.find((t) => t !== 'Ocean View Suite' && t !== 'Couples Massage');
  check(
    'text does NOT recommend a different restaurant than the one in the card',
    !answer.includes('The Terrace') || bundledRestaurant === 'The Terrace',
    `bundled restaurant in card: ${bundledRestaurant}`,
  );

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
