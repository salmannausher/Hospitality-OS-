// Sprint 3 — wire the remaining prompt modules (wedding, spa, family-travel,
// business-travel) onto base.md by the classifier's domain/persona output
// (AI Engine §3, docs/15-prompt-library-implementation-prompts.md Prompts
// 1–5's own "wire the selection logic" step). The five module files and the
// registry already existed (scaffolded earlier) — this verifies the actual
// runtime selection logic in PromptsService.assembleSystemPrompt, both in
// isolation and wired end to end through ChatService.streamTurn.
// Run `pnpm run build` first.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { ChatService } = require('./dist/src/ai/chat.service.js');
const { PromptsService } = require('./dist/src/ai/prompts.service.js');
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
  const prompts = app.get(PromptsService);
  const chat = app.get(ChatService);
  const gateway = app.get(GatewayService);
  const embeddings = app.get(EmbeddingsService);
  const prisma = app.get(PrismaService);
  const realClassify = gateway.classify.bind(gateway);
  const realEmbedQuery = embeddings.embedQuery.bind(embeddings);
  const realStreamGeneration = gateway.streamGeneration.bind(gateway);

  const baseArgs = {
    conciergeName: 'The Bellevue Concierge',
    hotelName: 'Bellevue Hotel',
    formalityLevel: 'formal and refined',
    brandAdjectives: 'gracious, polished, discreet',
    ragContext: '(none)',
    messageHistory: '(none)',
  };

  const GENERAL = 'No specific occasion or traveler type has been detected yet';
  const WEDDING = 'This guest is exploring the property for a wedding or large event';
  const SPA = 'Recommend treatments only from indexed spa content';
  const FAMILY = 'Lead with practical logistics';
  const BUSINESS = 'Be efficient. Minimize flourish';

  // --- Unit-level: PromptsService.assembleSystemPrompt's module selection.
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: [], persona: null });
    check('no domain/persona → general.md only', p.includes(GENERAL) && ![WEDDING, SPA, FAMILY, BUSINESS].some((m) => p.includes(m)), '');
  }
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: ['events'], persona: null });
    check("domain includes 'events' → wedding.md, general.md excluded", p.includes(WEDDING) && !p.includes(GENERAL), '');
  }
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: [], persona: 'wedding_planner' });
    check("persona 'wedding_planner' → wedding.md too (OR condition)", p.includes(WEDDING) && !p.includes(GENERAL), '');
  }
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: ['spa'], persona: null });
    check("domain includes 'spa' → spa.md, general.md excluded", p.includes(SPA) && !p.includes(GENERAL), '');
  }
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: [], persona: 'family_traveler' });
    check("persona 'family_traveler' → family-travel.md, general.md excluded", p.includes(FAMILY) && !p.includes(GENERAL), '');
  }
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: [], persona: 'business_traveler' });
    check("persona 'business_traveler' → business-travel.md, general.md excluded", p.includes(BUSINESS) && !p.includes(GENERAL), '');
  }
  {
    // Additive composition: a family traveler asking about spa gets BOTH modules (Prompt 4 step 3's own example).
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: ['spa'], persona: 'family_traveler' });
    check('family_traveler + spa domain composes BOTH modules additively', p.includes(FAMILY) && p.includes(SPA) && !p.includes(GENERAL), '');
  }
  {
    // No double-injection when both wedding conditions match at once.
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: ['events'], persona: 'wedding_planner' });
    const occurrences = p.split(WEDDING).length - 1;
    check('wedding.md is not duplicated when both its trigger conditions match', occurrences === 1, `occurrences=${occurrences}`);
  }
  {
    const p = prompts.assembleSystemPrompt({ ...baseArgs, domain: ['dining'], persona: 'luxury_traveler' });
    check('an unmatched domain/persona combination falls back to general.md', p.includes(GENERAL) && ![WEDDING, SPA, FAMILY, BUSINESS].some((m) => p.includes(m)), '');
  }

  // --- End-to-end: the classifier's actual output flows into the real
  // generation call's system prompt through ChatService, not just PromptsService in isolation.
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
  console.log(`\nUsing hotel ${hotelId}\n`);

  let capturedSystemPrompt = null;
  const stub = (classification) => {
    gateway.classify = async () => ({ classification, degraded: false });
    embeddings.embedQuery = async () => stubVector;
    gateway.streamGeneration = (input) => {
      capturedSystemPrompt = input.systemPrompt;
      return {
        textStream: (async function* () {
          yield 'A grounded, on-brand reply.';
        })(),
        getError: () => null,
      };
    };
  };
  const restore = () => {
    gateway.classify = realClassify;
    embeddings.embedQuery = realEmbedQuery;
    gateway.streamGeneration = realStreamGeneration;
  };

  // G-16-style: family_traveler + spa domain, wired end to end through the real pipeline.
  try {
    capturedSystemPrompt = null;
    stub({
      journeyState: 'planning',
      domain: ['spa', 'accommodation'],
      persona: 'family_traveler',
      rewrittenQuery: 'What spa treatments and rooms work well for a family of four?',
      detectedSignals: { occasion: null, leadCaptureWorthy: false, explicitHandoffRequest: false },
    });
    await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'What spa treatments and rooms work well for a family of four?',
    });
    check('[end-to-end] real generation call receives both family-travel.md and spa.md', capturedSystemPrompt?.includes(FAMILY) && capturedSystemPrompt?.includes(SPA) && !capturedSystemPrompt?.includes(GENERAL), '');
  } finally {
    restore();
  }

  // G-09-style: a wedding inquiry. 'events' alone has zero indexed chunks in
  // the seeded content (same gap verify-escalation.mjs relies on deliberately
  // for its Low-Confidence case) — a real wedding inquiry plausibly touches
  // accommodation too, and combining both domains here is what actually lets
  // retrieval find real content, so this exercises the module-selection wiring
  // through a genuine generation call rather than the Low-Confidence path.
  try {
    capturedSystemPrompt = null;
    stub({
      journeyState: 'planning',
      domain: ['events', 'accommodation'],
      persona: null,
      rewrittenQuery: "We're exploring the property for our wedding next year and would need rooms for guests.",
      detectedSignals: { occasion: null, leadCaptureWorthy: false, explicitHandoffRequest: false },
    });
    await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: "We're exploring the property for our wedding next year and would need rooms for guests.",
    });
    check('[end-to-end][G-09] real generation call receives wedding.md', capturedSystemPrompt?.includes(WEDDING) && !capturedSystemPrompt?.includes(GENERAL), '');
  } finally {
    restore();
  }

  // G-00-style: a plain welcome/greeting with no domain or persona signal — general.md only.
  try {
    capturedSystemPrompt = null;
    stub({
      journeyState: 'information',
      domain: [],
      persona: null,
      rewrittenQuery: 'Hi there!',
      detectedSignals: { occasion: null, leadCaptureWorthy: false, explicitHandoffRequest: false },
    });
    await collect(chat, {
      hotelId,
      sessionId: `verify_${randomUUID()}`,
      conversationId: null,
      message: 'Hi there!',
    });
    check('[end-to-end][G-00] no domain/persona signal → general.md only in the real generation call', capturedSystemPrompt?.includes(GENERAL) && ![WEDDING, SPA, FAMILY, BUSINESS].some((m) => capturedSystemPrompt?.includes(m)), '');
  } finally {
    restore();
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
