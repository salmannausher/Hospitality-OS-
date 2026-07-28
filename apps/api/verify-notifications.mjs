// Sprint 4, ticket 7 — verify Notifications wired to real events (API §3.7)
// end to end: NEW_LEAD fires from LeadsService.submitAnswer (consented) and
// createManual; ESCALATION fires from EscalationsService.create; a second
// NEW_LEAD fires from EscalationsService.choose's contact_me capture path;
// INGESTION_FAILED fires only on Document.status === 'FAILED', never
// 'NEEDS_REVIEW' (findings-log.md #21). Every trigger notifies ALL
// HotelMembership rows for the hotel (no broadcast/role concept on the
// schema). Also verifies NotificationsService.list/markRead scoping,
// filtering, and pagination. Run `pnpm run build` first.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { LeadsService } = require('./dist/src/leads/leads.service.js');
const { EscalationsService } = require('./dist/src/escalations/escalations.service.js');
const { IngestionService } = require('./dist/src/knowledge/ingestion.service.js');
const { NotificationsService } = require('./dist/src/admin/notifications/notifications.service.js');
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
  const leads = app.get(LeadsService);
  const escalations = app.get(EscalationsService);
  const ingestion = app.get(IngestionService);
  const notifications = app.get(NotificationsService);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}\n`);

  const members = await prisma.withTenant(hotelId, (tx) =>
    tx.$queryRaw`SELECT "userId" FROM "HotelMembership" WHERE "hotelId" = ${hotelId}`,
  );
  if (members.length === 0) throw new Error('No HotelMembership found for this hotel — run prisma/seed-admin.mjs first.');
  const recipientId = members[0].userId;
  console.log(`${members.length} hotel member(s) — every trigger below should notify all of them.\n`);

  const countPending = async (type) =>
    (
      await prisma.withTenant(hotelId, (tx) =>
        tx.$queryRaw`SELECT COUNT(*)::int AS n FROM "Notification" WHERE "hotelId" = ${hotelId} AND "type" = ${type}::"NotificationType" AND "status" = 'PENDING'`,
      )
    )[0].n;

  const newConversation = async () => {
    const id = `c_${randomUUID().replace(/-/g, '')}`;
    await prisma.withTenant(hotelId, (tx) =>
      tx.conversation.create({
        data: { id, hotelId, guestSessionId: `verify_${randomUUID()}` },
      }),
    );
    return id;
  };

  // --- NEW_LEAD from LeadsService.submitAnswer (consented).
  const beforeChatLead = await countPending('NEW_LEAD');
  const chatConversationId = await newConversation();
  const chatSubmit = await leads.submitAnswer(hotelId, {
    conversationId: chatConversationId,
    promptId: 'lp_verify',
    field: 'email',
    value: 'notify-guest@example.com',
    consent: true,
  });
  const afterChatLead = await countPending('NEW_LEAD');
  check(
    'submitAnswer (consented, new lead) notifies every hotel member',
    afterChatLead - beforeChatLead === members.length,
    `${beforeChatLead} -> ${afterChatLead}, expected +${members.length}`,
  );

  // --- NEW_LEAD from LeadsService.createManual.
  const beforeManualLead = await countPending('NEW_LEAD');
  const manualLead = await leads.createManual(hotelId, { email: 'walkin-notify@example.com' });
  const afterManualLead = await countPending('NEW_LEAD');
  check(
    'createManual notifies every hotel member',
    afterManualLead - beforeManualLead === members.length,
    `${beforeManualLead} -> ${afterManualLead}, expected +${members.length}`,
  );

  // --- ESCALATION from EscalationsService.create.
  const beforeEscalation = await countPending('ESCALATION');
  const escalationConversationId = await newConversation();
  const escalationId = await escalations.create(hotelId, escalationConversationId, 'guest requested a manager');
  const afterEscalation = await countPending('ESCALATION');
  check(
    'EscalationsService.create notifies every hotel member',
    afterEscalation - beforeEscalation === members.length,
    `${beforeEscalation} -> ${afterEscalation}, expected +${members.length}`,
  );

  // --- NEW_LEAD from EscalationsService.choose's contact_me capture path.
  const beforeChooseLead = await countPending('NEW_LEAD');
  await escalations.choose(hotelId, {
    escalationId,
    choice: 'contact_me',
    contact: { email: 'escalation-notify@example.com' },
  });
  const afterChooseLead = await countPending('NEW_LEAD');
  check(
    'escalation contact_me capture notifies every hotel member (new lead)',
    afterChooseLead - beforeChooseLead === members.length,
    `${beforeChooseLead} -> ${afterChooseLead}, expected +${members.length}`,
  );

  // --- INGESTION_FAILED fires on Document.status === 'FAILED'...
  const makeDocument = async () =>
    prisma.withTenant(hotelId, (tx) =>
      tx.document.create({
        data: {
          hotelId,
          filename: `verify-${randomUUID()}.txt`,
          sourceType: 'TEXT',
          storageUrl: 'verify://inline',
        },
      }),
    );

  const failedDoc = await makeDocument();
  const beforeFailed = await countPending('INGESTION_FAILED');
  await ingestion['finalizeDocument'](hotelId, failedDoc.id, 'FAILED', ['parse error']);
  const afterFailed = await countPending('INGESTION_FAILED');
  check(
    'finalizeDocument(FAILED) notifies every hotel member',
    afterFailed - beforeFailed === members.length,
    `${beforeFailed} -> ${afterFailed}, expected +${members.length}`,
  );

  // --- ...but never on NEEDS_REVIEW.
  const needsReviewDoc = await makeDocument();
  const beforeNeedsReview = await countPending('INGESTION_FAILED');
  await ingestion['finalizeDocument'](hotelId, needsReviewDoc.id, 'NEEDS_REVIEW', ['missing capacity']);
  const afterNeedsReview = await countPending('INGESTION_FAILED');
  check(
    'finalizeDocument(NEEDS_REVIEW) does NOT notify (findings-log.md #21)',
    afterNeedsReview === beforeNeedsReview,
    `${beforeNeedsReview} -> ${afterNeedsReview}, expected no change`,
  );

  // --- NotificationsService.list(): scoped to recipientId, status filter, cursor pagination.
  const allForRecipient = await notifications.list(hotelId, recipientId, {});
  check(
    'list() picked up the NEW_LEAD notification from submitAnswer',
    allForRecipient.items.some((n) => n.type === 'NEW_LEAD' && n.payload.leadId === chatSubmit.leadId),
    JSON.stringify(allForRecipient.items[0]),
  );

  const pendingOnly = await notifications.list(hotelId, recipientId, { status: 'PENDING' });
  check('list(status=PENDING) returns only PENDING rows', pendingOnly.items.every((n) => n.status === 'PENDING'), pendingOnly.items.length);

  try {
    await notifications.list(hotelId, recipientId, { status: 'NOT_A_STATUS' });
    check('list() rejects an invalid status filter', false, 'expected BadRequestException');
  } catch (err) {
    check('list() rejects an invalid status filter', err?.response?.error?.code === 'INVALID_STATUS', err?.message);
  }

  const page1 = await notifications.list(hotelId, recipientId, { limit: 1 });
  check('list(limit=1) returns exactly one item with a nextCursor', page1.items.length === 1 && typeof page1.nextCursor === 'string', JSON.stringify(page1));
  const page2 = await notifications.list(hotelId, recipientId, { limit: 1, cursor: page1.nextCursor });
  check('page 2 (via cursor) returns a different item than page 1', page2.items[0]?.id !== page1.items[0]?.id, `${page1.items[0]?.id} vs ${page2.items[0]?.id}`);

  // --- markRead(): PENDING -> READ, scoped to recipientId, 404s otherwise.
  const toMarkRead = pendingOnly.items[0];
  const marked = await notifications.markRead(hotelId, recipientId, toMarkRead.id);
  check('markRead() transitions PENDING -> READ', marked.status === 'READ', marked.status);

  const readOnly = await notifications.list(hotelId, recipientId, { status: 'READ' });
  check('list(status=READ) now includes the marked-read notification', readOnly.items.some((n) => n.id === toMarkRead.id), readOnly.items.length);

  try {
    await notifications.markRead(hotelId, recipientId, 'not_a_real_id');
    check('markRead() 404s on an unknown notification id', false, 'expected NotFoundException');
  } catch (err) {
    check('markRead() 404s on an unknown notification id', err?.response?.error?.code === 'NOTIFICATION_NOT_FOUND', err?.message);
  }

  if (members.length > 1) {
    const otherRecipientId = members[1].userId;
    try {
      await notifications.markRead(hotelId, otherRecipientId, toMarkRead.id);
      check('markRead() 404s when the notification belongs to a different recipient', false, 'expected NotFoundException');
    } catch (err) {
      check('markRead() 404s when the notification belongs to a different recipient', err?.response?.error?.code === 'NOTIFICATION_NOT_FOUND', err?.message);
    }
  } else {
    console.log('SKIP  cross-recipient markRead check — only one HotelMembership on this hotel');
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
