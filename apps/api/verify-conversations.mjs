// Sprint 4, ticket 2 — verify the Conversation list + thread view + QA
// scoring surface (API §3.4, UX §11, ABS §15) end to end: real chat turns
// actually populate the flags the thread view needs (findings-log.md #14 —
// Message.escalationTriggered/leadCaptureTriggered were never set before
// this ticket), the list's derived fields (topic tags, journeyState,
// escalated, hasLead, leadScore) and filters, qa-score create/409/validate/
// revise, and flag-for-playbook (including its two real error cases). Same
// stubbing pattern as the other chat-pipeline verify scripts: GatewayService
// .classify stubbed with the exact classification a working classifier would
// produce (still blocked on its own separate billing restriction,
// findings-log.md #1); EmbeddingsService.embedQuery returns a real chunk's
// own already-embedded vector for deterministic, on-topic retrieval.
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
const { ConversationsService } = require('./dist/src/admin/conversations/conversations.service.js');
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
  const conversations = app.get(ConversationsService);
  const realClassify = gateway.classify.bind(gateway);
  const realEmbedQuery = embeddings.embedQuery.bind(embeddings);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');

  // Domain-specific stub vectors — a chunk's embedding matching the domain
  // under test, so retrieval's hard domain filter (IA §7) actually finds
  // candidates instead of falling through to an incidental low_confidence
  // escalation (the exact mistake this script itself made on its first run:
  // one arbitrary chunk's vector doesn't necessarily overlap any given
  // domain, and IA §7's filter is domain-overlap, not similarity alone).
  const vectorForDomain = async (domain) => {
    const [{ embedding }] = await prisma.withTenant(
      hotelId,
      (tx) => tx.$queryRaw`
        SELECT embedding::text AS embedding FROM "Chunk"
        WHERE ${domain} = ANY("domainTags")
        LIMIT 1
      `,
    );
    return embedding.slice(1, -1).split(',').map(Number);
  };
  const spaVector = await vectorForDomain('spa');
  const propertyVector = await vectorForDomain('property');
  console.log(`Using hotel ${hotelId}\n`);

  const stub = (classification, vector = spaVector) => {
    gateway.classify = async () => ({ classification, degraded: false });
    embeddings.embedQuery = async () => vector;
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

  // --- Conversation A: Service Recovery — escalation-triggering turn.
  let conversationA;
  try {
    stub({
      journeyState: 'service_recovery',
      domain: ['policies'],
      persona: null,
      rewrittenQuery: 'The air conditioning in my room is broken.',
      detectedSignals: baseSignals(),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'The air conditioning in my room is broken and no one has come.',
    });
    conversationA = events.find((e) => e.type === 'ack').conversationId;
  } finally {
    restore();
  }

  // --- Conversation B: booking_intent + leadCaptureWorthy — lead_prompt fires, then a Lead is captured.
  let conversationB;
  try {
    stub({
      journeyState: 'booking_intent',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: 'Which suite is best for four nights with two kids?',
      detectedSignals: baseSignals({ leadCaptureWorthy: true }),
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Which suite is best for four nights with two kids?',
    });
    conversationB = events.find((e) => e.type === 'ack').conversationId;
    check(
      '[setup B] lead_prompt fired this turn',
      events.some((e) => e.type === 'lead_prompt'),
      events.map((e) => e.type).join(','),
    );
  } finally {
    restore();
  }
  await leads.submitAnswer(hotelId, {
    conversationId: conversationB,
    promptId: 'lp_verify_conversations',
    field: 'dates',
    value: 'next month, 4 nights',
    consent: true,
  });

  // --- Conversation C: plain information turn — no escalation, no lead.
  let conversationC;
  try {
    stub(
      {
        journeyState: 'information',
        domain: ['property'],
        persona: null,
        rewrittenQuery: 'What time is checkout?',
        detectedSignals: baseSignals(),
      },
      propertyVector,
    );
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'What time is checkout?',
    });
    conversationC = events.find((e) => e.type === 'ack').conversationId;
  } finally {
    restore();
  }

  // --- findings-log.md #14: escalationTriggered/leadCaptureTriggered actually land on Message rows.
  const detailA = await conversations.get(hotelId, conversationA);
  const concergeMsgA = detailA.messages.find((m) => m.role === 'CONCIERGE');
  check(
    '[#14] escalationTriggered=true on the concierge message that escalated',
    concergeMsgA?.escalationTriggered === true,
    JSON.stringify(concergeMsgA),
  );
  check(
    '[#14] leadCaptureTriggered=false on that same message (no lead signal this turn)',
    concergeMsgA?.leadCaptureTriggered === false,
  );

  const detailB = await conversations.get(hotelId, conversationB);
  const concergeMsgB = detailB.messages.find((m) => m.role === 'CONCIERGE');
  check(
    '[#14] leadCaptureTriggered=true on the concierge message that prompted for a lead',
    concergeMsgB?.leadCaptureTriggered === true,
    JSON.stringify(concergeMsgB),
  );
  check(
    '[#14] escalationTriggered=false on that same message',
    concergeMsgB?.escalationTriggered === false,
  );

  // --- Derived list-row fields.
  check('[detail A] escalated=true, journeyState=service_recovery', detailA.escalated === true && detailA.journeyState === 'service_recovery', JSON.stringify({ escalated: detailA.escalated, journeyState: detailA.journeyState }));
  check('[detail B] hasLead=true after submitAnswer', detailB.hasLead === true);
  check('[detail B] domainTags include spa', detailB.domainTags.includes('spa'), JSON.stringify(detailB.domainTags));
  check('[detail B] messageCount is 2 (one guest, one concierge turn)', detailB.messageCount === 2, String(detailB.messageCount));

  const detailC = await conversations.get(hotelId, conversationC);
  check('[detail C] escalated=false, hasLead=false, journeyState=information', detailC.escalated === false && detailC.hasLead === false && detailC.journeyState === 'information', JSON.stringify({ escalated: detailC.escalated, hasLead: detailC.hasLead, journeyState: detailC.journeyState }));
  check('[detail C] qaScore is null before any score is submitted', detailC.qaScore === null);

  // --- List filters.
  const escalatedOnly = await conversations.list(hotelId, { escalated: true, limit: 100 });
  check('[list] escalated=true includes conversation A', escalatedOnly.items.some((c) => c.id === conversationA), `count=${escalatedOnly.items.length}`);
  check('[list] escalated=true excludes conversation C', !escalatedOnly.items.some((c) => c.id === conversationC));

  const hasLeadOnly = await conversations.list(hotelId, { hasLead: true, limit: 100 });
  check('[list] hasLead=true includes conversation B', hasLeadOnly.items.some((c) => c.id === conversationB));
  check('[list] hasLead=true excludes conversation C', !hasLeadOnly.items.some((c) => c.id === conversationC));

  const journeyFiltered = await conversations.list(hotelId, { journeyState: 'information', limit: 100 });
  check('[list] journeyState=information includes conversation C', journeyFiltered.items.some((c) => c.id === conversationC));

  // --- Pagination.
  const page1 = await conversations.list(hotelId, { limit: 1 });
  check('[list] limit=1 returns exactly one item with a nextCursor', page1.items.length === 1 && typeof page1.nextCursor === 'string', JSON.stringify(page1));
  const page2 = await conversations.list(hotelId, { limit: 1, cursor: page1.nextCursor });
  check('[list] page 2 (via cursor) returns a different item than page 1', page2.items[0]?.id !== page1.items[0]?.id, JSON.stringify({ page1: page1.items[0]?.id, page2: page2.items[0]?.id }));

  // --- QA scoring: create, 409 on duplicate, validation, revise.
  const scoreInput = { grounding: 5, tone: 4, escalation: 5, leadCapture: 3, resolution: 4 };
  const created = await conversations.submitQaScore(hotelId, conversationA, scoreInput, 'qa-verify@example.com');
  check('[qa-score] create returns the submitted scores', created.grounding === 5 && created.tone === 4 && created.scoredBy === 'qa-verify@example.com', JSON.stringify(created));

  try {
    await conversations.submitQaScore(hotelId, conversationA, scoreInput, 'qa-verify@example.com');
    check('[qa-score] duplicate create is rejected with 409', false, 'expected ConflictException');
  } catch (err) {
    check('[qa-score] duplicate create is rejected with 409', err?.status === 409 && err?.response?.error?.code === 'QA_SCORE_ALREADY_EXISTS', JSON.stringify(err?.response));
  }

  try {
    await conversations.submitQaScore(hotelId, conversationC, { ...scoreInput, grounding: 6 }, 'qa-verify@example.com');
    check('[qa-score] out-of-range value (6) is rejected', false, 'expected BadRequestException');
  } catch (err) {
    check('[qa-score] out-of-range value (6) is rejected', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  try {
    await conversations.reviseQaScore(hotelId, conversationC, scoreInput);
    check('[qa-score] revising a non-existent score 404s', false, 'expected NotFoundException');
  } catch (err) {
    check('[qa-score] revising a non-existent score 404s', err?.status === 404 && err?.response?.error?.code === 'QA_SCORE_NOT_FOUND', JSON.stringify(err?.response));
  }

  const revised = await conversations.reviseQaScore(hotelId, conversationA, { ...scoreInput, grounding: 2 });
  check('[qa-score] revise updates the score', revised.grounding === 2, JSON.stringify(revised));
  const detailAAfterScore = await conversations.get(hotelId, conversationA);
  check('[qa-score] the revised score is reflected in the thread detail', detailAAfterScore.qaScore?.grounding === 2, JSON.stringify(detailAAfterScore.qaScore));

  // --- Flag for Playbook: happy path, deriving domain/journeyState/expected* from the transcript.
  const flaggedA = await conversations.flagForPlaybook(hotelId, conversationA, {});
  check('[flag] creates a scenario', typeof flaggedA.scenarioId === 'string' && flaggedA.scenarioId.length > 0, JSON.stringify(flaggedA));
  const scenarioA = await prisma.withTenant(hotelId, (tx) => tx.playbookScenario.findUnique({ where: { id: flaggedA.scenarioId } }));
  check('[flag] scenario derives journeyState=service_recovery, escalationExpected=true, source=PILOT_TRANSCRIPT, sourceConversationId set', scenarioA.journeyState === 'service_recovery' && scenarioA.escalationExpected === true && scenarioA.source === 'PILOT_TRANSCRIPT' && scenarioA.sourceConversationId === conversationA, JSON.stringify(scenarioA));
  check('[flag] guestMessage matches the flagged conversation\'s first guest message', scenarioA.guestMessage === 'The air conditioning in my room is broken and no one has come.', scenarioA.guestMessage);

  const flaggedB = await conversations.flagForPlaybook(hotelId, conversationB, {
    expectedBehavior: ['Recommend a family-friendly suite', 'Ask about dates'],
    mustNot: ['Invent room availability'],
  });
  const scenarioB = await prisma.withTenant(hotelId, (tx) => tx.playbookScenario.findUnique({ where: { id: flaggedB.scenarioId } }));
  check('[flag] body-provided expectedBehavior/mustNot are persisted', JSON.stringify(scenarioB.expectedBehavior) === JSON.stringify(['Recommend a family-friendly suite', 'Ask about dates']) && JSON.stringify(scenarioB.mustNot) === JSON.stringify(['Invent room availability']), JSON.stringify({ expectedBehavior: scenarioB.expectedBehavior, mustNot: scenarioB.mustNot }));
  check('[flag] leadCaptureExpected defaults true from the observed message flag', scenarioB.leadCaptureExpected === true);

  // --- Flag for Playbook: error cases.
  try {
    await conversations.flagForPlaybook(hotelId, conversationA, { messageId: 'msg_does_not_exist' });
    check('[flag] unknown messageId is rejected', false, 'expected BadRequestException');
  } catch (err) {
    check('[flag] unknown messageId is rejected', err?.response?.error?.code === 'GUEST_MESSAGE_NOT_FOUND', err?.message);
  }

  // A conversation with a guest message but no concierge reply yet — flagging it can't infer a journeyState.
  const bareConversationId = `c_${randomUUID().replace(/-/g, '')}`;
  await prisma.withTenant(hotelId, (tx) =>
    tx.conversation.create({ data: { id: bareConversationId, hotelId, guestSessionId: `verify_${randomUUID()}` } }),
  );
  await prisma.withTenant(hotelId, (tx) =>
    tx.message.create({ data: { hotelId, conversationId: bareConversationId, role: 'GUEST', content: 'Hello?' } }),
  );
  try {
    await conversations.flagForPlaybook(hotelId, bareConversationId, {});
    check('[flag] a conversation with no concierge reply yet is rejected (cannot infer journeyState)', false, 'expected BadRequestException');
  } catch (err) {
    check('[flag] a conversation with no concierge reply yet is rejected (cannot infer journeyState)', err?.response?.error?.code === 'JOURNEY_STATE_UNKNOWN', err?.message);
  }

  // --- Not-found guard on the conversation detail endpoint itself.
  try {
    await conversations.get(hotelId, 'c_does_not_exist');
    check('[detail] unknown conversation id 404s', false, 'expected NotFoundException');
  } catch (err) {
    check('[detail] unknown conversation id 404s', err?.status === 404 && err?.response?.error?.code === 'CONVERSATION_NOT_FOUND', JSON.stringify(err?.response));
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
