// Sprint 4, ticket 6 — verify the Analytics surface (API §3.6, UX §12):
// `getTopics` (domain distribution counted per-conversation) and `getGaps`
// (repeated LOW-confidence domains, MIN_GAP_COUNT=2, recommendedAction
// phrases — findings-log.md #20). No chat-pipeline stubbing needed here —
// AnalyticsService reads Message rows directly, so test data is written
// directly via Prisma, matching exactly the shape ChatService.
// persistConciergeTurn produces (only CONCIERGE-role messages ever carry
// domainTags/confidenceBand — GUEST messages never do).
// Run `pnpm run build` first.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { AnalyticsService } = require('./dist/src/admin/analytics/analytics.service.js');
const { AdminAnalyticsController } = require('./dist/src/admin/analytics/analytics.controller.js');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service.js');

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

try {
  const prisma = app.get(PrismaService);
  const analytics = app.get(AnalyticsService);
  const controller = app.get(AdminAnalyticsController);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}\n`);

  const newConversation = () =>
    prisma.withTenant(hotelId, (tx) =>
      tx.conversation.create({
        data: {
          id: `c_${randomUUID().replace(/-/g, '')}`,
          hotelId,
          guestSessionId: `verify_${randomUUID()}`,
        },
      }),
    );

  const writeConciergeMessage = (conversationId, { domainTags, confidenceBand }) =>
    prisma.withTenant(hotelId, (tx) =>
      tx.message.create({
        data: {
          hotelId,
          conversationId,
          role: 'CONCIERGE',
          content: 'verify message',
          journeyState: 'information',
          domainTags,
          confidenceBand,
        },
      }),
    );

  const topicsMap = (rows) => new Map(rows.map((r) => [r.domain, r.count]));

  // --- getTopics(): counts CONVERSATIONS a domain appeared in, not raw messages.
  const before = topicsMap(await analytics.getTopics(hotelId));

  const convA = await newConversation();
  await writeConciergeMessage(convA.id, { domainTags: ['booking', 'events'], confidenceBand: 'HIGH' });
  const convB = await newConversation();
  await writeConciergeMessage(convB.id, { domainTags: ['booking'], confidenceBand: 'MEDIUM' });
  // A second message in the SAME conversation touching 'booking' again must
  // not double-count — conversation B should still add exactly 1 to 'booking'.
  await writeConciergeMessage(convB.id, { domainTags: ['booking'], confidenceBand: 'MEDIUM' });

  const after = topicsMap(await analytics.getTopics(hotelId));
  const bookingDelta = (after.get('booking') ?? 0) - (before.get('booking') ?? 0);
  const eventsDelta = (after.get('events') ?? 0) - (before.get('events') ?? 0);
  check('getTopics: 2 new conversations touching "booking" adds exactly 2', bookingDelta === 2, `delta=${bookingDelta}`);
  check('getTopics: 1 new conversation touching "events" adds exactly 1', eventsDelta === 1, `delta=${eventsDelta}`);

  const sortedDesc = (await analytics.getTopics(hotelId)).every(
    (row, i, arr) => i === 0 || arr[i - 1].count >= row.count,
  );
  check('getTopics: sorted descending by count', sortedDesc);

  // --- getGaps(): MIN_GAP_COUNT threshold, isolated to a narrow time window
  // so real historical test data from months of prior tickets can't interfere.
  const windowStart = new Date();
  const gap1Conv = await newConversation();
  await writeConciergeMessage(gap1Conv.id, { domainTags: ['local_area'], confidenceBand: 'LOW' });
  const afterOne = await analytics.getGaps(hotelId, windowStart, new Date());
  check(
    'getGaps: a single LOW-confidence occurrence does not surface as a gap (below MIN_GAP_COUNT)',
    !afterOne.some((g) => g.domain === 'local_area'),
    JSON.stringify(afterOne),
  );

  const gap2Conv = await newConversation();
  await writeConciergeMessage(gap2Conv.id, { domainTags: ['local_area'], confidenceBand: 'LOW' });
  const afterTwo = await analytics.getGaps(hotelId, windowStart, new Date());
  const localAreaGap = afterTwo.find((g) => g.domain === 'local_area');
  check(
    'getGaps: a second LOW-confidence occurrence surfaces the gap at exactly count=2',
    localAreaGap?.lowConfidenceCount === 2,
    JSON.stringify(localAreaGap),
  );
  check(
    'getGaps: recommendedAction is the domain-specific phrase',
    localAreaGap?.recommendedAction === 'Add local area recommendations',
    localAreaGap?.recommendedAction,
  );

  // --- HIGH/MEDIUM confidence never counts toward a gap.
  const nonLowConv = await newConversation();
  await writeConciergeMessage(nonLowConv.id, { domainTags: ['local_area'], confidenceBand: 'HIGH' });
  const afterHigh = await analytics.getGaps(hotelId, windowStart, new Date());
  const localAreaGapAfterHigh = afterHigh.find((g) => g.domain === 'local_area');
  check(
    'getGaps: a HIGH-confidence message does not inflate the gap count',
    localAreaGapAfterHigh?.lowConfidenceCount === 2,
    localAreaGapAfterHigh?.lowConfidenceCount,
  );

  // --- API §3.6's own literal example.
  const spaConv1 = await newConversation();
  await writeConciergeMessage(spaConv1.id, { domainTags: ['spa'], confidenceBand: 'LOW' });
  const spaConv2 = await newConversation();
  await writeConciergeMessage(spaConv2.id, { domainTags: ['spa'], confidenceBand: 'LOW' });
  const spaGaps = await analytics.getGaps(hotelId, windowStart, new Date());
  const spaGap = spaGaps.find((g) => g.domain === 'spa');
  check('getGaps: spa recommendedAction matches API §3.6\'s own example', spaGap?.recommendedAction === 'Upload your spa menu', spaGap?.recommendedAction);

  const gapsSortedDesc = spaGaps.every((row, i, arr) => i === 0 || arr[i - 1].lowConfidenceCount >= row.lowConfidenceCount);
  check('getGaps: sorted descending by lowConfidenceCount', gapsSortedDesc);

  // --- Controller-level validation (the parsing/default logic HTTP requests actually hit).
  const defaultGaps = await controller.gaps(hotelId, undefined, undefined);
  check('gaps() controller: omitting from/to defaults to a window and returns real data', Array.isArray(defaultGaps));

  try {
    await controller.gaps(hotelId, 'not-a-date', undefined);
    check('gaps() controller rejects an invalid "from" date', false, 'expected BadRequestException');
  } catch (err) {
    check('gaps() controller rejects an invalid "from" date', err?.response?.error?.code === 'INVALID_DATE', err?.message);
  }

  try {
    await controller.gaps(hotelId, new Date().toISOString(), '2020-01-01');
    check('gaps() controller rejects from > to', false, 'expected BadRequestException');
  } catch (err) {
    check('gaps() controller rejects from > to', err?.response?.error?.code === 'INVALID_RANGE', err?.message);
  }

  const topicsViaController = await controller.topics(hotelId);
  check('topics() controller returns an array', Array.isArray(topicsViaController));

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
