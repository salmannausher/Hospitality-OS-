// Sprint 3 — verify the cta SSE event + lifecycle-stage logic (API §2.1, UX
// §6). Same stubbing pattern as the other Sprint 3 chat verify scripts:
// GatewayService.classify is stubbed with the exact classification a working
// classifier would produce (the AI Gateway classifier model is still blocked
// on a separate, unresolved billing restriction — see docs/14-sprint-backlog.md
// Sprint 3); EmbeddingsService.embedQuery is stubbed with a real chunk's own
// vector for deterministic, on-topic retrieval.
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
    (tx) => tx.$queryRaw`
      SELECT embedding::text AS embedding FROM "Chunk"
      WHERE 'policies' = ANY("domainTags")
      LIMIT 1
    `,
  );
  const stubVector = chunkEmbeddingText.slice(1, -1).split(',').map(Number);
  console.log(`Using hotel ${hotelId}\n`);

  const stub = (classification) => {
    gateway.classify = async () => ({ classification, degraded: false });
    embeddings.embedQuery = async () => stubVector;
  };
  const restore = () => {
    gateway.classify = realClassify;
    embeddings.embedQuery = realEmbedQuery;
  };

  const base = (lifecycleStage, journeyState = 'information') => ({
    journeyState,
    domain: ['policies'],
    persona: null,
    rewrittenQuery: 'test message',
    detectedSignals: { occasion: null, leadCaptureWorthy: false, explicitHandoffRequest: false, lifecycleStage },
  });

  const turn = async (classification) => {
    stub(classification);
    try {
      return await collect(chat, {
        hotelId,
        sessionId: `verify_${randomUUID()}`,
        conversationId: null,
        message: 'test message',
      });
    } finally {
      restore();
    }
  };

  // --- Ensure a known starting state: no bookingEngineUrl configured.
  await prisma.withTenant(hotelId, (tx) =>
    tx.brandSettings.update({ where: { hotelId }, data: { bookingEngineUrl: null } }),
  );

  // --- Every lifecycle stage maps to the right cta kind, unconfigured URL → ''.
  const expectedKind = {
    dreaming: 'explore_rooms',
    researching: 'explore_rooms',
    comparing: 'explore_rooms',
    booking: 'book_now',
    preparing: 'plan_my_stay',
    staying: 'request_assistance',
  };
  for (const [stage, kind] of Object.entries(expectedKind)) {
    const events = await turn(base(stage));
    const types = events.map((e) => e.type);
    const ctaEvent = events.find((e) => e.type === 'cta');
    check(`[${stage}] fires exactly one cta event with kind=${kind}`, types.filter((t) => t === 'cta').length === 1 && ctaEvent?.kind === kind, JSON.stringify(ctaEvent));
    check(`[${stage}] cta fires after the last delta/side-event, before done`, types.indexOf('cta') < types.indexOf('done') && types.indexOf('cta') > types.lastIndexOf('delta'), types.join(','));
    check(`[${stage}] unconfigured bookingEngineUrl → empty url`, ctaEvent?.url === '', JSON.stringify(ctaEvent));
  }

  // --- Never book_now for an already-booked (preparing) or on-property (staying) guest — the core UX §6 rule.
  {
    const preparingCta = (await turn(base('preparing'))).find((e) => e.type === 'cta');
    const stayingCta = (await turn(base('staying'))).find((e) => e.type === 'cta');
    check('preparing never gets book_now', preparingCta?.kind !== 'book_now', preparingCta?.kind);
    check('staying never gets book_now', stayingCta?.kind !== 'book_now', stayingCta?.kind);
  }

  // --- Configure a real bookingEngineUrl and confirm it flows through.
  const TEST_URL = 'https://book.bellevue-hotel.example.com/reserve';
  await prisma.withTenant(hotelId, (tx) =>
    tx.brandSettings.update({ where: { hotelId }, data: { bookingEngineUrl: TEST_URL } }),
  );
  try {
    const bookNowCta = (await turn(base('booking'))).find((e) => e.type === 'cta');
    check('book_now uses the configured bookingEngineUrl', bookNowCta?.url === TEST_URL, JSON.stringify(bookNowCta));

    const exploreCta = (await turn(base('researching'))).find((e) => e.type === 'cta');
    check('explore_rooms uses the same configured bookingEngineUrl', exploreCta?.url === TEST_URL, JSON.stringify(exploreCta));

    const planCta = (await turn(base('preparing'))).find((e) => e.type === 'cta');
    check('plan_my_stay falls back to the same configured bookingEngineUrl (documented interim decision)', planCta?.url === TEST_URL, JSON.stringify(planCta));

    const assistCta = (await turn(base('staying'))).find((e) => e.type === 'cta');
    check('request_assistance NEVER uses bookingEngineUrl, even when configured — not a link-out', assistCta?.url === '', JSON.stringify(assistCta));
  } finally {
    await prisma.withTenant(hotelId, (tx) =>
      tx.brandSettings.update({ where: { hotelId }, data: { bookingEngineUrl: null } }),
    );
  }

  // --- CTA is unconditional: fires even on an escalated (Service Recovery) turn,
  // reflecting the Staying-stage row of UX §6's own table (request_assistance IS
  // the escalation-appropriate CTA, not something escalation suppresses).
  {
    const events = await turn(base('staying', 'service_recovery'));
    const types = events.map((e) => e.type);
    const ctaEvent = events.find((e) => e.type === 'cta');
    check('an escalated turn still gets exactly one cta event', types.filter((t) => t === 'cta').length === 1 && ctaEvent?.kind === 'request_assistance', types.join(','));
    check('escalation + cta co-occur in the same turn (cta is not suppressed by escalation)', types.includes('escalation') && types.includes('cta'), types.join(','));
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
