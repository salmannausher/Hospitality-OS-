// Sprint 3, ticket 5 — verify the escalation SSE event + POST
// /v1/chat/escalation/choose (API §2.1/§2.3, ABS §7, UX §5), tested directly
// against Playbook G-11 (confirming zero recommendation/upsell activity once
// it fires). Same stubbing pattern as verify-chat-cards.mjs/
// verify-lead-capture.mjs: GatewayService.classify is stubbed with the exact
// classification a working classifier would produce (the AI Gateway
// classifier model is still blocked on a separate, unresolved billing
// restriction — see docs/14-sprint-backlog.md Sprint 3); EmbeddingsService.
// embedQuery is stubbed with a real chunk's own vector for deterministic,
// on-topic retrieval (Voyage itself is unblocked as of 2026-07-23).
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
const { EscalationsService } = require('./dist/src/escalations/escalations.service.js');
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
  const escalationsService = app.get(EscalationsService);
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
  const baseSignals = { occasion: null, leadCaptureWorthy: false, explicitHandoffRequest: false };

  // --- G-11: Service Recovery — the one that must never upsell.
  let escalationIdG11;
  try {
    stub({
      journeyState: 'service_recovery',
      domain: ['policies'],
      persona: null,
      rewrittenQuery: "The air conditioning in my room isn't working and no one has come to fix it.",
      detectedSignals: baseSignals,
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "The air conditioning in my room isn't working and no one has come to fix it.",
      contextTag: 'anniversary', // deliberately supplied — must still be ignored (ABS §19).
    });
    const types = events.map((e) => e.type);
    const escalationEvent = events.find((e) => e.type === 'escalation');
    const deltaEvents = events.filter((e) => e.type === 'delta');
    escalationIdG11 = escalationEvent?.escalationId;

    check('[G-11] fires exactly one escalation event', types.filter((t) => t === 'escalation').length === 1, types.join(','));
    check('[G-11] escalation fires after the last delta, before done', types.indexOf('escalation') > types.lastIndexOf('delta') && types.indexOf('escalation') < types.indexOf('done'), types.join(','));
    check('[G-11] reason is service_recovery', escalationEvent?.reason === 'service_recovery', escalationEvent?.reason);
    check('[G-11] only contact_me is offered (no live staff channel in V1)', JSON.stringify(escalationEvent?.options) === JSON.stringify(['contact_me']) && escalationEvent?.liveStaffAvailable === false, JSON.stringify(escalationEvent));
    check('[G-11] exactly one short acknowledgment delta, no troubleshooting attempt', deltaEvents.length === 1 && deltaEvents[0].text.split(/(?<=[.!?])\s/).length <= 2, JSON.stringify(deltaEvents));
    check('[G-11] zero card events (no recommendation/upsell activity)', !types.includes('card'), types.join(','));
    check('[G-11] zero lead_prompt events (capture folds into the handoff, not a separate ask)', !types.includes('lead_prompt'), types.join(','));
    check('[G-11] done still fires exactly once, reporting service_recovery', types.filter((t) => t === 'done').length === 1 && events.find((e) => e.type === 'done')?.journeyState === 'service_recovery', types.join(','));

    const escalationRow = await prisma.withTenant(hotelId, (tx) =>
      tx.escalation.findFirst({ where: { id: escalationIdG11 } }),
    );
    check('[G-11] Escalation row persisted with the structured reason tag', escalationRow?.reason === 'service_recovery', JSON.stringify(escalationRow));
  } finally {
    restore();
  }

  // --- Explicit human request — independent of journey state, must still escalate.
  try {
    stub({
      journeyState: 'planning',
      domain: ['accommodation'],
      persona: null,
      rewrittenQuery: "We're planning our anniversary trip — can I talk to a person about it?",
      detectedSignals: { occasion: 'anniversary', leadCaptureWorthy: true, explicitHandoffRequest: true },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "We're planning our anniversary trip — can I talk to a person about it?",
      contextTag: 'anniversary',
    });
    const types = events.map((e) => e.type);
    const escalationEvent = events.find((e) => e.type === 'escalation');
    check('[explicit request] fires an escalation with reason=explicit_request even in a Planning state with occasion+lead signals present', escalationEvent?.reason === 'explicit_request', JSON.stringify(escalationEvent));
    check('[explicit request] zero card events despite a real contextTag+Planning state', !types.includes('card'), types.join(','));
    check('[explicit request] zero lead_prompt events despite leadCaptureWorthy=true', !types.includes('lead_prompt'), types.join(','));
  } finally {
    restore();
  }

  // --- Low confidence — ABS §5: "Do not answer from the model. Use escalation pattern."
  try {
    stub({
      journeyState: 'information',
      // 'events' has zero indexed chunks in the seeded content (prisma/seed.mjs)
      // — IA §7's hard domain filter guarantees an empty candidate set here
      // regardless of the stub vector, forcing the genuine
      // topChunks.length === 0 path rather than a spuriously high self-match.
      domain: ['events'],
      persona: null,
      rewrittenQuery: 'Do you have a Michelin-starred sushi omakase counter on site?',
      detectedSignals: baseSignals,
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Do you have a Michelin-starred sushi omakase counter on site?',
    });
    const types = events.map((e) => e.type);
    const escalationEvent = events.find((e) => e.type === 'escalation');
    const doneEvent = events.find((e) => e.type === 'done');
    check('[low confidence] fires an escalation with reason=low_confidence', escalationEvent?.reason === 'low_confidence', JSON.stringify(escalationEvent));
    check('[low confidence] done reports confidenceBand=LOW', doneEvent?.confidenceBand === 'LOW', JSON.stringify(doneEvent));
    check('[low confidence] zero card/lead_prompt events', !types.includes('card') && !types.includes('lead_prompt'), types.join(','));
  } finally {
    restore();
  }

  // --- Regression: a normal Planning+occasion turn with NO escalation trigger still fires its card (ticket 3 behavior unbroken).
  try {
    stub({
      journeyState: 'planning',
      domain: ['accommodation', 'dining', 'spa'],
      persona: null,
      rewrittenQuery: "We're celebrating our anniversary — any recommendations?",
      detectedSignals: { occasion: 'anniversary', leadCaptureWorthy: false, explicitHandoffRequest: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "We're celebrating our anniversary — any recommendations?",
    });
    const types = events.map((e) => e.type);
    check('[regression] a normal Planning+occasion turn still fires card, not escalation', types.includes('card') && !types.includes('escalation'), types.join(','));
  } finally {
    restore();
  }

  // --- EscalationsService.choose() — validation guards.
  try {
    await escalationsService.choose(hotelId, { escalationId: undefined, choice: 'contact_me' });
    check('choose rejects a missing escalationId', false, 'expected BadRequestException');
  } catch (err) {
    check('choose rejects a missing escalationId', err?.response?.error?.code === 'MISSING_FIELD', err?.message);
  }
  try {
    await escalationsService.choose(hotelId, { escalationId: escalationIdG11, choice: 'teleport' });
    check('choose rejects an invalid choice value', false, 'expected BadRequestException');
  } catch (err) {
    check('choose rejects an invalid choice value', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }
  try {
    await escalationsService.choose(hotelId, { escalationId: 'e_does_not_exist', choice: 'contact_me' });
    check('choose 404s on a non-existent escalationId', false, 'expected NotFoundException');
  } catch (err) {
    check('choose 404s on a non-existent escalationId', err?.response?.error?.code === 'ESCALATION_NOT_FOUND', err?.message);
  }
  try {
    await escalationsService.choose(hotelId, { escalationId: escalationIdG11, choice: 'connect_now' });
    check('choose rejects connect_now (no live staff channel in V1)', false, 'expected BadRequestException');
  } catch (err) {
    check('choose rejects connect_now (no live staff channel in V1)', err?.response?.error?.code === 'LIVE_STAFF_UNAVAILABLE', err?.message);
  }

  // --- EscalationsService.choose() — real contact_me capture, folded into Lead (ABS §8).
  {
    const result = await escalationsService.choose(hotelId, {
      escalationId: escalationIdG11,
      choice: 'contact_me',
      contact: { email: 'guest@example.com' },
    });
    check('choose(contact_me) returns the UX §5 confirmation message', result.message === 'Our team has your conversation and will follow up shortly.', JSON.stringify(result));

    const conversationId = await prisma.withTenant(hotelId, (tx) =>
      tx.escalation.findFirst({ where: { id: escalationIdG11 } }).then((e) => e.conversationId),
    );
    const lead = await prisma.withTenant(hotelId, (tx) =>
      tx.lead.findFirst({ where: { conversationId, deletedAt: null } }),
    );
    check('choose(contact_me) creates a Lead scoped to the escalation\'s conversation', lead?.email === 'guest@example.com' && lead?.consentGiven === true, JSON.stringify(lead));

    // Idempotent in effect: a second contact_me submission updates the same Lead, not a second one.
    await escalationsService.choose(hotelId, {
      escalationId: escalationIdG11,
      choice: 'contact_me',
      contact: { phone: '+1-555-0100' },
    });
    const leadCount = await prisma.withTenant(hotelId, (tx) =>
      tx.lead.count({ where: { conversationId } }),
    );
    const updatedLead = await prisma.withTenant(hotelId, (tx) =>
      tx.lead.findFirst({ where: { conversationId, deletedAt: null } }),
    );
    check('a second contact_me submission updates the same Lead row, not a duplicate', leadCount === 1 && updatedLead?.phone === '+1-555-0100' && updatedLead?.email === 'guest@example.com', `count=${leadCount}, ${JSON.stringify(updatedLead)}`);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
