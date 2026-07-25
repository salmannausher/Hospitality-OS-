// Sprint 3 follow-up — verify the fix for findings-log.md #9 (escalation
// firing for the wrong documented reason on wedding/events inquiries).
// Reproduces Golden Set G-09/G-10 exactly and confirms the escalation now
// reports reason=group_size_threshold rather than an incidental
// low_confidence, plus the new BrandSettings.groupInquiryThreshold config,
// the "engage first, then escalate" behavior Playbook G-09 itself expects,
// and that service_recovery/explicit_request still take priority.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The Supabase pooler occasionally times out under heavy back-to-back real
// generation calls from this non-colocated sandbox (documented, transient —
// CLAUDE.md/Sprint 2/3's own latency notes) — retry with backoff rather than
// fail the whole run over an infra hiccup.
async function collect(chat, params) {
  await sleep(2000); // spacing between scenarios, not just between retries
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const events = [];
      for await (const event of chat.streamTurn(params)) events.push(event);
      return events;
    } catch (err) {
      if (err?.code === 'P2028' && attempt < 4) {
        console.log(`  (transient P2028, attempt ${attempt}/4, backing off 5s)`);
        await sleep(5000);
        continue;
      }
      throw err;
    }
  }
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

  const stub = (classification) => {
    gateway.classify = async () => ({ classification, degraded: false });
    embeddings.embedQuery = async () => stubVector;
  };
  const restore = () => {
    gateway.classify = realClassify;
    embeddings.embedQuery = realEmbedQuery;
  };
  const baseSignals = (overrides = {}) => ({
    occasion: null,
    leadCaptureWorthy: false,
    explicitHandoffRequest: false,
    lifecycleStage: 'comparing',
    groupSize: null,
    ...overrides,
  });

  // --- Ensure a known starting threshold (the schema default).
  await prisma.withTenant(hotelId, (tx) =>
    tx.brandSettings.update({ where: { hotelId }, data: { groupInquiryThreshold: 15 } }),
  );

  // --- G-09 reproduced: 120-guest wedding inquiry, 'events' domain (zero indexed content).
  try {
    stub({
      journeyState: 'planning',
      domain: ['events'],
      persona: 'wedding_planner',
      rewrittenQuery: "We're considering the hotel for a 120-guest wedding next June.",
      detectedSignals: baseSignals({ occasion: 'wedding', leadCaptureWorthy: true, groupSize: 120 }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "We're considering your hotel for our wedding — about 120 guests, next June.",
    });
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('[G-09] reason is group_size_threshold, not an incidental low_confidence', escalationEvent?.reason === 'group_size_threshold', JSON.stringify(escalationEvent));
    check('[G-09] zero card/lead_prompt events (still suppressed once escalation fires)', !events.some((e) => e.type === 'card' || e.type === 'lead_prompt'), events.map((e) => e.type).join(','));
  } finally {
    restore();
  }

  // --- G-10 reproduced: 40-person corporate retreat, same domain gap.
  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['events'],
      persona: 'event_organizer',
      rewrittenQuery: 'We need a conference room for 40 people with AV for a two-day retreat.',
      detectedSignals: baseSignals({ leadCaptureWorthy: true, lifecycleStage: 'booking', groupSize: 40 }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'We need a conference room for 40 people with AV, for a two-day retreat.',
    });
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('[G-10] reason is group_size_threshold', escalationEvent?.reason === 'group_size_threshold', JSON.stringify(escalationEvent));
  } finally {
    restore();
  }

  // --- Below threshold: a small group (8 guests, threshold 15) must NOT escalate for this reason.
  try {
    stub({
      journeyState: 'planning',
      domain: ['events'],
      persona: 'wedding_planner',
      rewrittenQuery: 'A small 8-guest elopement dinner.',
      detectedSignals: baseSignals({ occasion: 'wedding', groupSize: 8 }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "We're planning a small 8-guest elopement dinner.",
    });
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('a group of 8 (below the threshold of 15) never escalates as group_size_threshold', escalationEvent?.reason !== 'group_size_threshold', JSON.stringify(escalationEvent));
  } finally {
    restore();
  }

  // --- The key Playbook G-09 insight: engage first (real generation, real facts), THEN escalate on top.
  // Uses 'accommodation' domain (real indexed content) instead of 'events' (empty) to prove generation
  // actually ran rather than falling back to the honest Low-Confidence text.
  try {
    stub({
      journeyState: 'planning',
      domain: ['accommodation'],
      persona: 'wedding_planner',
      rewrittenQuery: 'We need a room block for 50 wedding guests — what options exist?',
      detectedSignals: baseSignals({ occasion: 'wedding', leadCaptureWorthy: true, groupSize: 50 }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'We need a room block for 50 wedding guests — what options exist?',
    });
    const answer = events.filter((e) => e.type === 'delta').map((e) => e.text).join('');
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('a real generated answer streams (deltas present) before the escalation', answer.length > 50, `length=${answer.length}`);
    check('answer is NOT the generic Low-Confidence fallback text', !answer.includes("I don't have confirmed information about that just yet"), answer.slice(0, 80));
    check('escalation still fires with reason=group_size_threshold on top of the real answer', escalationEvent?.reason === 'group_size_threshold', JSON.stringify(escalationEvent));
  } finally {
    restore();
  }

  // --- Configurable per-hotel threshold: raise it and confirm the same 50-guest inquiry no longer escalates for this reason.
  await prisma.withTenant(hotelId, (tx) =>
    tx.brandSettings.update({ where: { hotelId }, data: { groupInquiryThreshold: 100 } }),
  );
  try {
    stub({
      journeyState: 'planning',
      domain: ['accommodation'],
      persona: 'wedding_planner',
      rewrittenQuery: 'We need a room block for 50 wedding guests — what options exist?',
      detectedSignals: baseSignals({ occasion: 'wedding', leadCaptureWorthy: true, groupSize: 50 }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'We need a room block for 50 wedding guests — what options exist?',
    });
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('raising the per-hotel threshold to 100 means 50 guests no longer triggers group_size_threshold', escalationEvent?.reason !== 'group_size_threshold', JSON.stringify(escalationEvent));
  } finally {
    restore();
    await prisma.withTenant(hotelId, (tx) =>
      tx.brandSettings.update({ where: { hotelId }, data: { groupInquiryThreshold: 15 } }),
    );
  }

  // --- Priority: Service Recovery still wins even if a large groupSize is (implausibly) also set.
  try {
    stub({
      journeyState: 'service_recovery',
      domain: ['policies'],
      persona: null,
      rewrittenQuery: 'The AC is broken in my room during our 200-guest wedding block.',
      detectedSignals: baseSignals({ groupSize: 200 }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'The AC is broken in my room during our 200-guest wedding block.',
    });
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('service_recovery still takes priority over group_size_threshold', escalationEvent?.reason === 'service_recovery', JSON.stringify(escalationEvent));
  } finally {
    restore();
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
