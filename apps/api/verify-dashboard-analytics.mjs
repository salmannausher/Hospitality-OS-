// Sprint 4, ticket 1 — verify the Dashboard KPI tiles' data path (API §3.6,
// UX §8) end to end: real chat turns / lead capture / escalation calls
// actually bump `DailyMetric` (findings-log.md #12 — nothing wrote to this
// table before this ticket), and `AnalyticsService.getDaily` /
// `AdminAnalyticsController.daily` read it back correctly, date-range
// filtering and validation included. Same stubbing pattern as the other
// chat-pipeline verify scripts: GatewayService.classify is stubbed with the
// exact classification a working classifier would produce (still blocked on
// its own separate billing restriction, findings-log.md #1);
// EmbeddingsService.embedQuery returns a real chunk's own already-embedded
// vector for deterministic, on-topic retrieval.
//
// Measures BEFORE/AFTER deltas rather than assuming today's row starts at
// zero — this script (and the real product) can run more than once per day.
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
const { LeadsService } = require('./dist/src/leads/leads.service.js');
const { EscalationsService } = require('./dist/src/escalations/escalations.service.js');
const { AnalyticsService } = require('./dist/src/admin/analytics/analytics.service.js');
const { AdminAnalyticsController } = require('./dist/src/admin/analytics/analytics.controller.js');
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const ZERO_ROW = {
  messageCount: 0,
  conversationCount: 0,
  bookingIntentCount: 0,
  leadCount: 0,
  escalationCount: 0,
};

function diff(before, after) {
  const b = before ?? ZERO_ROW;
  const a = after ?? ZERO_ROW;
  return {
    messageCount: a.messageCount - b.messageCount,
    conversationCount: a.conversationCount - b.conversationCount,
    bookingIntentCount: a.bookingIntentCount - b.bookingIntentCount,
    leadCount: a.leadCount - b.leadCount,
    escalationCount: a.escalationCount - b.escalationCount,
  };
}

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

try {
  const prisma = app.get(PrismaService);
  const chat = app.get(ChatService);
  const gateway = app.get(GatewayService);
  const embeddings = app.get(EmbeddingsService);
  const leads = app.get(LeadsService);
  const escalations = app.get(EscalationsService);
  const analytics = app.get(AnalyticsService);
  const controller = app.get(AdminAnalyticsController);
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
    lifecycleStage: 'researching',
    groupSize: null,
    offTopicOrRefusal: false,
    ...overrides,
  });

  const today = todayIso();
  const todayRow = async () => (await analytics.getDaily(hotelId, new Date(today), new Date(today)))[0] ?? null;

  // `Lead.conversationId`/`Escalation.conversationId` are real FKs to
  // `Conversation` — unlike the chat-turn scenarios above (which get a real
  // row via `ChatService.openTurn`), these direct service calls need one
  // created explicitly first.
  const newConversation = async () => {
    const id = `c_${randomUUID().replace(/-/g, '')}`;
    await prisma.withTenant(hotelId, (tx) =>
      tx.conversation.create({
        data: { id, hotelId, guestSessionId: `verify_${randomUUID()}` },
      }),
    );
    return id;
  };

  // --- A new chat turn (new conversation) bumps messageCount by 2 (guest +
  // concierge) and conversationCount by 1.
  let before = await todayRow();
  let conversationId;
  try {
    stub({
      journeyState: 'information',
      domain: ['property'],
      persona: null,
      rewrittenQuery: "What time is checkout?",
      detectedSignals: baseSignals(),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'What time is checkout?',
    });
    conversationId = events.find((e) => e.type === 'ack').conversationId;
  } finally {
    restore();
  }
  let after = await todayRow();
  let d = diff(before, after);
  check('New conversation bumps conversationCount by 1', d.conversationCount === 1, JSON.stringify(d));
  check('First turn bumps messageCount by 2 (guest + concierge)', d.messageCount === 2, JSON.stringify(d));
  check('Non-booking-intent turn does not bump bookingIntentCount', d.bookingIntentCount === 0, JSON.stringify(d));

  // --- A second turn in the SAME conversation bumps messageCount again, but NOT conversationCount.
  before = after;
  try {
    stub({
      journeyState: 'information',
      domain: ['property'],
      persona: null,
      rewrittenQuery: 'And breakfast?',
      detectedSignals: baseSignals(),
    });
    await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId,
      message: 'And breakfast?',
    });
  } finally {
    restore();
  }
  after = await todayRow();
  d = diff(before, after);
  check('A reused conversation does not bump conversationCount again', d.conversationCount === 0, JSON.stringify(d));
  check('A second turn still bumps messageCount by 2', d.messageCount === 2, JSON.stringify(d));

  // --- A booking_intent turn bumps bookingIntentCount.
  before = after;
  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: 'Which suite is best for four nights with two kids?',
      detectedSignals: baseSignals({ leadCaptureWorthy: true }),
    });
    await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Which suite is best for four nights with two kids?',
    });
  } finally {
    restore();
  }
  after = await todayRow();
  d = diff(before, after);
  check('A booking_intent turn bumps bookingIntentCount by 1', d.bookingIntentCount === 1, JSON.stringify(d));

  // --- A new, consented lead bumps leadCount by exactly 1, not on subsequent field submissions.
  before = after;
  const leadConversationId = await newConversation();
  const consentResult = await leads.submitAnswer(hotelId, {
    conversationId: leadConversationId,
    promptId: 'lp_verify',
    field: 'dates',
    value: null,
    consent: true,
  });
  after = await todayRow();
  d = diff(before, after);
  check('A new consented lead bumps leadCount by 1', d.leadCount === 1, JSON.stringify(d));

  before = after;
  await leads.submitAnswer(hotelId, {
    conversationId: leadConversationId,
    promptId: 'lp_verify',
    field: 'dates',
    value: 'next month',
    consent: true,
  });
  after = await todayRow();
  d = diff(before, after);
  check('A follow-up field submission on the same lead does not double-count leadCount', d.leadCount === 0, JSON.stringify(d));

  // --- A declined lead never bumps leadCount.
  before = after;
  await leads.submitAnswer(hotelId, {
    conversationId: await newConversation(),
    promptId: 'lp_verify_decline',
    field: 'dates',
    value: null,
    consent: false,
    declined: true,
  });
  after = await todayRow();
  d = diff(before, after);
  check('A declined lead does not bump leadCount', d.leadCount === 0, JSON.stringify(d));

  // --- An escalation bumps escalationCount by 1.
  before = after;
  const escalationId = await escalations.create(hotelId, await newConversation(), 'explicit_request');
  after = await todayRow();
  d = diff(before, after);
  check('A new escalation bumps escalationCount by 1', d.escalationCount === 1, JSON.stringify(d));

  // --- contact_me capture on an escalation with no prior Lead bumps leadCount too.
  before = after;
  await escalations.choose(hotelId, {
    escalationId,
    choice: 'contact_me',
    contact: { email: 'guest@example.com' },
  });
  after = await todayRow();
  d = diff(before, after);
  check('contact_me capturing a NEW lead bumps leadCount by 1', d.leadCount === 1, JSON.stringify(d));

  // --- Date-range filtering: a range excluding today returns no row for today.
  const farFuture = await analytics.getDaily(hotelId, new Date('2099-01-01'), new Date('2099-01-02'));
  check('A date range excluding today returns no rows', farFuture.length === 0, JSON.stringify(farFuture));

  const includesToday = await analytics.getDaily(hotelId, new Date('2020-01-01'), new Date(today));
  check(
    "A range including today's date returns exactly one row for today",
    includesToday.filter((r) => r.date === today).length === 1,
    JSON.stringify(includesToday.map((r) => r.date)),
  );

  // --- Row shape matches the documented type, avgSatisfaction stays null (findings-log.md #12).
  const finalRow = await todayRow();
  check(
    'Row shape has every DailyMetricRow field',
    finalRow &&
      typeof finalRow.date === 'string' &&
      typeof finalRow.messageCount === 'number' &&
      typeof finalRow.conversationCount === 'number' &&
      typeof finalRow.bookingIntentCount === 'number' &&
      typeof finalRow.leadCount === 'number' &&
      typeof finalRow.escalationCount === 'number' &&
      'avgSatisfaction' in finalRow,
    JSON.stringify(finalRow),
  );
  check('avgSatisfaction stays null — no capture mechanism exists yet', finalRow?.avgSatisfaction === null, String(finalRow?.avgSatisfaction));

  // --- Controller-level validation (the parsing/default logic HTTP requests actually hit).
  const defaulted = await controller.daily(hotelId, undefined, undefined);
  check('Omitting from/to defaults to a window ending today', defaulted.some((r) => r.date === today), JSON.stringify(defaulted.map((r) => r.date)));

  try {
    await controller.daily(hotelId, 'not-a-date', undefined);
    check('Controller rejects an invalid "from" date', false, 'expected BadRequestException');
  } catch (err) {
    check('Controller rejects an invalid "from" date', err?.response?.error?.code === 'INVALID_DATE', err?.message);
  }

  try {
    await controller.daily(hotelId, today, '2020-01-01');
    check('Controller rejects from > to', false, 'expected BadRequestException');
  } catch (err) {
    check('Controller rejects from > to', err?.response?.error?.code === 'INVALID_RANGE', err?.message);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
