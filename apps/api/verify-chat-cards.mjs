// Sprint 3, ticket 3 — verify the `card` SSE event wired into the live guest
// chat pipeline (API §2.1, ABS §9/§16/§18/§19), tested directly against
// Playbook G-05 (the anniversary bundle). Boots the real Nest app context
// against the real Supabase DB (RLS, app_role) and the real Bellevue hotel —
// same pattern as verify-entities.mjs / verify-relationships.mjs.
//
// Two honest caveats, stated up front rather than hidden — both are
// pre-existing account-billing restrictions, not ticket 3 defects:
//   1. The AI Gateway classifier model (haiku) is blocked by the free-tier
//      restriction already documented in docs/14-sprint-backlog.md Sprint 2.
//   2. Voyage embeddings are ALSO currently rate-limited (429, "add a payment
//      method") — a second, separate provider billing restriction discovered
//      while building this verification. Flagged in the Sprint 3 backlog
//      entry alongside this ticket, not silently patched around.
// Test A below runs completely unstubbed and shows the real, correct, safe
// consequence of restriction #1 (classification degrades, so no card fires —
// recommending without a confirmed journey state would be wrong). Tests B-F
// stub GatewayService.classify (with the exact classification a working
// classifier would produce for each Playbook scenario) AND
// EmbeddingsService.embedQuery (returning a real, already-embedded chunk's
// own vector, fetched live from the DB — a deterministic stand-in for the
// one Voyage call, not a fabricated result) so the rest of the pipeline —
// real retrieval SQL, real confidence scoring, real streamed generation
// (sonnet-5, which IS live), and real card assembly against the real seeded
// "anniversary" bundle — is exercised for real, unaffected by either billing
// restriction.
// Run `pnpm run build` and `node prisma/seed-relationships.mjs` first.
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

function assertOrdering(events) {
  const types = events.map((e) => e.type);
  const ackFirst = types[0] === 'ack';
  const lastIsDoneOrError = ['done', 'error'].includes(types[types.length - 1]);
  const cardIdx = types.indexOf('card');
  const lastDeltaIdx = types.lastIndexOf('delta');
  const cardAfterDeltas = cardIdx === -1 || cardIdx > lastDeltaIdx;
  return { types, ackFirst, lastIsDoneOrError, cardAfterDeltas };
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
  console.log(`Using hotel ${hotelId}`);

  // A real, already-embedded chunk's own vector — Voyage is separately
  // rate-limited right now (see file header), so this stands in for the one
  // live embedQuery call in tests B/C/D/E/F, deterministically, from real data.
  // Must actually carry the 'spa' domain tag the test classifications below
  // declare — retrieval domain-filters (IA §7), so a self-matching chunk
  // outside that filter would still (correctly) yield an empty candidate set.
  const [{ embedding: chunkEmbeddingText }] = await prisma.withTenant(
    hotelId,
    (tx) => tx.$queryRaw`
      SELECT embedding::text AS embedding FROM "Chunk"
      WHERE 'spa' = ANY("domainTags")
      LIMIT 1
    `,
  );
  const stubVector = chunkEmbeddingText
    .slice(1, -1)
    .split(',')
    .map(Number);
  console.log(`Stub query embedding sourced from a real indexed chunk (${stubVector.length} dims)\n`);

  const G05_MESSAGE = "We're celebrating our 10th anniversary — any recommendations?";

  // --- Test A: fully live, unstubbed. Shows the real current consequence of
  // the AI Gateway classifier billing block, not a code defect.
  {
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: G05_MESSAGE,
    });
    const { types, ackFirst, lastIsDoneOrError, cardAfterDeltas } = assertOrdering(events);
    const done = events.find((e) => e.type === 'done');
    check('[A] ack fires first', ackFirst, types.join(','));
    check('[A] stream ends in done/error', lastIsDoneOrError, types.join(','));
    check('[A] card (if any) fires after the last delta', cardAfterDeltas, types.join(','));
    console.log(
      `     [A] journeyState=${done?.journeyState} card=${types.includes('card')} — ` +
        `${done?.journeyState === 'information' ? 'classifier degraded (AI Gateway billing block, expected right now — see backlog), card correctly suppressed' : 'classifier is live'}`,
    );
  }

  // --- Tests B-F: stub the classifier call and the one embedding call, to
  // exercise the rest of the real pipeline against each Playbook-relevant
  // classification, unaffected by either currently-blocked provider.
  const stub = (classification) => {
    gateway.classify = async () => ({ classification, degraded: false });
    embeddings.embedQuery = async () => stubVector;
  };
  const restore = () => {
    gateway.classify = realClassify;
    embeddings.embedQuery = realEmbedQuery;
  };

  // [B] G-05 itself: Planning + occasion=anniversary, detected from free text.
  try {
    stub({
      journeyState: 'planning',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: G05_MESSAGE,
      detectedSignals: { occasion: 'anniversary', leadCaptureWorthy: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: G05_MESSAGE,
    });
    const { types, cardAfterDeltas } = assertOrdering(events);
    const cardEvent = events.find((e) => e.type === 'card');
    const done = events.find((e) => e.type === 'done');
    check('[B] G-05 (planning + occasion=anniversary) fires exactly one card event', types.filter((t) => t === 'card').length === 1, types.join(','));
    check('[B] card fires after the last delta, before done', cardAfterDeltas);
    check(
      '[B] card bundle is the real seeded anniversary bundle (3 entities, deduped)',
      cardEvent?.cards?.length === 3,
      JSON.stringify(cardEvent?.cards?.map((c) => c.title)),
    );
    check(
      '[B] bundle includes Ocean View Suite, The Rooftop at Bellevue, and Couples Massage',
      ['Ocean View Suite', 'The Rooftop at Bellevue', 'Couples Massage'].every((name) =>
        cardEvent?.cards?.some((c) => c.title === name),
      ),
      JSON.stringify(cardEvent?.cards?.map((c) => c.title)),
    );
    check('[B] done reports the planning journey state', done?.journeyState === 'planning', done?.journeyState);
  } finally {
    restore();
  }

  // [C] Quick-start tap: contextTag supplied explicitly, occasion left null.
  try {
    stub({
      journeyState: 'planning',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: G05_MESSAGE,
      detectedSignals: { occasion: null, leadCaptureWorthy: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Any suggestions for us?',
      contextTag: 'anniversary',
    });
    const cardEvent = events.find((e) => e.type === 'card');
    check(
      '[C] an explicit client contextTag (quick-start tap) fires the card even with no classifier occasion',
      cardEvent?.cards?.length === 3,
      JSON.stringify(cardEvent?.cards?.map((c) => c.title)),
    );
  } finally {
    restore();
  }

  // [D] ABS §19 safety rule: Service Recovery must NEVER recommend, even if occasion is (implausibly) set.
  try {
    stub({
      journeyState: 'service_recovery',
      domain: ['policies'],
      persona: null,
      rewrittenQuery: 'The air conditioning in my room is broken.',
      detectedSignals: { occasion: 'anniversary', leadCaptureWorthy: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'The air conditioning in my room is broken and no one has come.',
      contextTag: 'anniversary',
    });
    check(
      '[D] Service Recovery never fires a card, even with contextTag + occasion both set',
      !events.some((e) => e.type === 'card'),
      events.map((e) => e.type).join(','),
    );
  } finally {
    restore();
  }

  // [E] Information state: no upsell needed, card must not fire even with a contextTag present.
  try {
    stub({
      journeyState: 'information',
      domain: ['policies'],
      persona: null,
      rewrittenQuery: 'What time is breakfast?',
      detectedSignals: { occasion: null, leadCaptureWorthy: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'What time is breakfast?',
      contextTag: 'anniversary',
    });
    check(
      '[E] Information journey state does not fire a card even with a contextTag present',
      !events.some((e) => e.type === 'card'),
      events.map((e) => e.type).join(','),
    );
  } finally {
    restore();
  }

  // [F] Planning + a contextTag with no curated bundle behind it: card assembly returns
  // an empty bundle, and the code must not emit an empty `card` event (API §2.1: cards are
  // only ever a real recommendation — an empty event is not "at most one card", it's noise).
  try {
    stub({
      journeyState: 'planning',
      domain: ['spa'],
      persona: null,
      rewrittenQuery: G05_MESSAGE,
      detectedSignals: { occasion: 'not-a-real-bundle-tag', leadCaptureWorthy: false },
    });
    const events = await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: G05_MESSAGE,
    });
    check(
      '[F] an uncurated contextTag (no matching relationship edges) never emits an empty card event',
      !events.some((e) => e.type === 'card'),
      events.map((e) => e.type).join(','),
    );
  } finally {
    restore();
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
