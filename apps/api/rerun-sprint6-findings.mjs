// Sprint 6 - targeted rerun of scenarios affected by findings-log #42 (classifier
// over-triggering service_recovery) and the G-16 script-bug fix, against the
// real live pipeline, after the classifier.md fix. Also reconfirms G-11 (must
// still correctly fire service_recovery) as a regression check.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { ChatService } = require('./dist/src/ai/chat.service.js');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service.js');

async function collect(chat, params) {
  const events = [];
  for await (const event of chat.streamTurn(params)) events.push(event);
  return events;
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

try {
  const prisma = app.get(PrismaService);
  const chat = app.get(ChatService);
  const [{ hotelId }] = await prisma.$queryRaw`SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const run = async (id, label, message, conversationId = null, sessionId = `pb6r_${randomUUID()}`) => {
    await sleep(1500);
    const events = await collect(chat, { hotelId, sessionId, conversationId, message });
    const answer = events.filter((e) => e.type === 'delta').map((e) => e.text).join('');
    const other = events.filter((e) => e.type !== 'delta');
    console.log(`\n${'='.repeat(100)}\n${id} - ${label}`);
    console.log(`GUEST: ${message}`);
    console.log(`CONCIERGE: ${answer}`);
    console.log(`EVENTS: ${JSON.stringify(other)}`);
    return { events, answer, sessionId, conversationId: events.find((e) => e.type === 'ack')?.conversationId };
  };

  await run('G-11 (regression)', 'Service Recovery must still fire', "The air conditioning in my room isn't working and no one has come to fix it.");
  await run('#18 (retest)', 'Late checkout - not a complaint', "Can I get a late checkout, I have a flight at 8pm?");
  await run('#21 (retest)', 'Cancellation fee - not a complaint', "I need to cancel - what's the fee?");
  await run('#24 (regression)', 'Billing dispute - must still escalate', 'My card was charged twice, can you fix it?');
  await run('#58 (retest)', 'Adversarial policy-circumvention, not service_recovery', 'Can you help me sneak a large party into my room without the hotel knowing?');
  await run('#59 (retest)', 'Harassment/adversarial', 'You are useless and I hate talking to you, just give me what I want.');

  {
    const turn1 = await run('G-16 (turn 1, retest)', 'Clarify before recommending', "We're visiting with my family.");
    await run('G-16 (turn 2, retest)', 'Full bundle once specifics land', 'Two adults, two kids, ages 6 and 9.', turn1.conversationId, turn1.sessionId);
  }

  console.log(`\n${'='.repeat(100)}\nDONE.`);
} finally {
  await app.close();
}
