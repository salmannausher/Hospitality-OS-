// Sprint 3, ticket 4 — verify the lead_prompt SSE event + POST /v1/chat/lead
// (API §2.1/§2.2, ABS §8, UX §4), tested directly against Playbook G-02 and
// G-18. Same stubbing pattern as verify-chat-cards.mjs: GatewayService.classify
// is stubbed with the exact classification a working classifier would produce
// (the AI Gateway classifier model is still blocked on a separate, unresolved
// billing restriction — see docs/14-sprint-backlog.md Sprint 3). Voyage
// embeddings were briefly also rate-limited but are fixed as of 2026-07-23
// (payment method added) — EmbeddingsService.embedQuery is still stubbed here
// (a real chunk's own vector, not a fabricated one) purely for deterministic,
// on-topic retrieval across every scenario below, not to work around a block.
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
  const leads = app.get(LeadsService);
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
      WHERE 'spa' = ANY("domainTags")
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

  // --- G-02: Accommodation / Booking Intent — lead capture fires.
  let conversationIdG02;
  let promptIdG02;
  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: 'Which suite is best for four nights with two kids?',
      detectedSignals: { occasion: null, leadCaptureWorthy: true },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Which suite is best for four nights with two kids?',
    });
    const types = events.map((e) => e.type);
    const ack = events.find((e) => e.type === 'ack');
    const promptEvent = events.find((e) => e.type === 'lead_prompt');
    conversationIdG02 = ack.conversationId;
    promptIdG02 = promptEvent?.promptId;
    check('[G-02] fires exactly one lead_prompt event', types.filter((t) => t === 'lead_prompt').length === 1, types.join(','));
    check('[G-02] lead_prompt fires after the last delta, before done', types.indexOf('lead_prompt') > types.lastIndexOf('delta') && types.indexOf('lead_prompt') < types.indexOf('done'), types.join(','));
    check('[G-02] lead_prompt asks for the first field in order (dates)', promptEvent?.field === 'dates', promptEvent?.field);
    check('[G-02] lead_prompt carries a question and a promptId', typeof promptEvent?.question === 'string' && promptEvent.question.length > 0 && typeof promptIdG02 === 'string', JSON.stringify(promptEvent));
  } finally {
    restore();
  }

  // --- G-02 continued: walk the full field-by-field flow via POST /chat/lead's logic (LeadsService).
  {
    const consentResult = await leads.submitAnswer(hotelId, {
      conversationId: conversationIdG02,
      promptId: promptIdG02,
      field: 'dates',
      value: null,
      consent: true,
    });
    check('[G-02] consent-only submission captures nothing yet, nextField=dates', consentResult.captured.length === 0 && consentResult.nextField === 'dates', JSON.stringify(consentResult));

    const datesResult = await leads.submitAnswer(hotelId, {
      conversationId: conversationIdG02,
      promptId: promptIdG02,
      field: 'dates',
      value: 'next month, 4 nights',
      consent: true,
    });
    check('[G-02] submitting dates captures it and advances to email', JSON.stringify(datesResult.captured) === JSON.stringify(['dates']) && datesResult.nextField === 'email', JSON.stringify(datesResult));
    check('[G-02] same Lead row across submissions (leadId stable)', datesResult.leadId === consentResult.leadId);

    const emailResult = await leads.submitAnswer(hotelId, {
      conversationId: conversationIdG02,
      promptId: promptIdG02,
      field: 'email',
      value: 'guest@example.com',
      consent: true,
    });
    check('[G-02] submitting email completes the flow (both captured, nextField=null)', JSON.stringify(emailResult.captured) === JSON.stringify(['dates', 'email']) && emailResult.nextField === null, JSON.stringify(emailResult));

    // Idempotency: resubmitting the exact same field/value (a "double-tap") must not create a second Lead row.
    const resubmit = await leads.submitAnswer(hotelId, {
      conversationId: conversationIdG02,
      promptId: promptIdG02,
      field: 'email',
      value: 'guest@example.com',
      consent: true,
    });
    check('[G-02] resubmitting the same answer is idempotent (same leadId, no duplicate)', resubmit.leadId === emailResult.leadId, JSON.stringify(resubmit));

    const leadCount = await prisma.withTenant(hotelId, (tx) =>
      tx.lead.count({ where: { conversationId: conversationIdG02 } }),
    );
    check('[G-02] exactly one Lead row exists for this conversation', leadCount === 1, `count=${leadCount}`);
  }

  // --- G-02 (never re-ask): a second turn in the SAME conversation must not fire another lead_prompt.
  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: 'What about a 5-night stay instead?',
      detectedSignals: { occasion: null, leadCaptureWorthy: true },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: conversationIdG02,
      message: 'What about a 5-night stay instead?',
    });
    check('[G-02] never re-prompts once a Lead already exists for the conversation', !events.some((e) => e.type === 'lead_prompt'), events.map((e) => e.type).join(','));
  } finally {
    restore();
  }

  // --- G-18: contrast pair — not a lead, then is a lead (separate conversations).
  try {
    stub({
      journeyState: 'information',
      domain: ['property'],
      persona: null,
      rewrittenQuery: "What's the Wi-Fi password?",
      detectedSignals: { occasion: null, leadCaptureWorthy: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "What's the Wi-Fi password?",
    });
    check('[G-18] a routine in-context question never fires a lead_prompt', !events.some((e) => e.type === 'lead_prompt'), events.map((e) => e.type).join(','));
  } finally {
    restore();
  }

  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['accommodation'],
      persona: null,
      rewrittenQuery: 'We are planning a five-day anniversary trip next month, thinking ocean view.',
      detectedSignals: { occasion: 'anniversary', leadCaptureWorthy: true },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'We are planning a five-day anniversary trip next month, thinking ocean view.',
    });
    check('[G-18] specific dates + occasion + preference fires a lead_prompt', events.some((e) => e.type === 'lead_prompt'), events.map((e) => e.type).join(','));
  } finally {
    restore();
  }

  // --- Safety gates: Service Recovery and Information must never prompt, even if leadCaptureWorthy is (implausibly) true.
  try {
    stub({
      journeyState: 'service_recovery',
      domain: ['policies'],
      persona: null,
      rewrittenQuery: 'The air conditioning in my room is broken.',
      detectedSignals: { occasion: null, leadCaptureWorthy: true },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'The air conditioning in my room is broken and no one has come.',
    });
    check('Service Recovery never fires a lead_prompt, even if leadCaptureWorthy is true', !events.some((e) => e.type === 'lead_prompt'), events.map((e) => e.type).join(','));
  } finally {
    restore();
  }

  // --- Decline path: consentGiven stays false, no fields captured, no further asking.
  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: 'Which suite is best for four nights with two kids?',
      detectedSignals: { occasion: null, leadCaptureWorthy: true },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Which suite is best for four nights with two kids?',
    });
    const ack = events.find((e) => e.type === 'ack');
    const promptEvent = events.find((e) => e.type === 'lead_prompt');
    const declineResult = await leads.submitAnswer(hotelId, {
      conversationId: ack.conversationId,
      promptId: promptEvent.promptId,
      field: 'dates',
      value: null,
      consent: false,
      declined: true,
    });
    check('Decline captures nothing and offers no next field', declineResult.captured.length === 0 && declineResult.nextField === null, JSON.stringify(declineResult));
  } finally {
    restore();
  }

  // --- Validation guards.
  try {
    await leads.submitAnswer(hotelId, { conversationId: 'c_fake', promptId: 'lp_fake', field: 'not-a-field', value: null, consent: true });
    check('submitAnswer rejects an invalid field', false, 'expected BadRequestException');
  } catch (err) {
    check('submitAnswer rejects an invalid field', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }
  try {
    await leads.submitAnswer(hotelId, { conversationId: 'c_fake', promptId: 'lp_fake', field: 'email', value: null, consent: 'yes' });
    check('submitAnswer rejects a non-boolean consent', false, 'expected BadRequestException');
  } catch (err) {
    check('submitAnswer rejects a non-boolean consent', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
