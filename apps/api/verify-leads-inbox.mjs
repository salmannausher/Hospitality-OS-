// Sprint 4, ticket 3 — verify the Leads inbox surface (API §3.4) end to end:
// list (status filter, cursor pagination), get, update (status/owner/notes,
// including the assignedOwnerId membership-validation guard), and manual
// entry. Confirms findings-log.md #15's derivation: a chat-captured lead
// (real conversationId) reports source="chat", a manually-entered one
// (conversationId: null) reports source="manual" — no stored column either
// way. Run `pnpm run build` first.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { LeadsService } = require('./dist/src/leads/leads.service.js');
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

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}\n`);

  // A real HotelMembership for this hotel, to test assignedOwnerId validation against.
  const membership = await prisma.withTenant(hotelId, () =>
    prisma.$queryRaw`SELECT "userId" FROM "HotelMembership" WHERE "hotelId" = ${hotelId} LIMIT 1`,
  );
  const realUserId = membership[0]?.userId;
  if (!realUserId) throw new Error('No HotelMembership found for this hotel — run prisma/seed-admin.mjs first.');

  const newConversation = async () => {
    const id = `c_${randomUUID().replace(/-/g, '')}`;
    await prisma.withTenant(hotelId, (tx) =>
      tx.conversation.create({
        data: { id, hotelId, guestSessionId: `verify_${randomUUID()}` },
      }),
    );
    return id;
  };

  // --- A chat-captured lead reports source="chat" and a real conversationId.
  const chatConversationId = await newConversation();
  const chatSubmit = await leads.submitAnswer(hotelId, {
    conversationId: chatConversationId,
    promptId: 'lp_verify',
    field: 'email',
    value: 'guest@example.com',
    consent: true,
  });
  const chatLead = await leads.get(hotelId, chatSubmit.leadId);
  check('A chat-captured lead reports source=chat', chatLead.source === 'chat', chatLead.source);
  check('A chat-captured lead keeps its conversationId', chatLead.conversationId === chatConversationId, chatLead.conversationId);

  // --- A manually-entered lead reports source="manual" and conversationId=null.
  const manualLead = await leads.createManual(hotelId, {
    name: 'Walk-in Guest',
    phone: '+1-555-0199',
    reasonForStay: 'Anniversary weekend',
  });
  check('A manual lead reports source=manual', manualLead.source === 'manual', manualLead.source);
  check('A manual lead has no conversationId', manualLead.conversationId === null, String(manualLead.conversationId));
  check('A manual lead persists the submitted fields', manualLead.name === 'Walk-in Guest' && manualLead.phone === '+1-555-0199' && manualLead.reasonForStay === 'Anniversary weekend', JSON.stringify(manualLead));

  // --- Manual entry validation: at least one contact field required.
  try {
    await leads.createManual(hotelId, { reasonForStay: 'Just curious' });
    check('createManual rejects a lead with no contact info', false, 'expected BadRequestException');
  } catch (err) {
    check('createManual rejects a lead with no contact info', err?.response?.error?.code === 'MISSING_CONTACT_INFO', err?.message);
  }

  // --- update(): status change.
  const statusUpdated = await leads.update(hotelId, manualLead.id, { status: 'CONTACTED' });
  check('update() changes status', statusUpdated.status === 'CONTACTED', statusUpdated.status);

  try {
    await leads.update(hotelId, manualLead.id, { status: 'NOT_A_STATUS' });
    check('update() rejects an invalid status', false, 'expected BadRequestException');
  } catch (err) {
    check('update() rejects an invalid status', err?.response?.error?.code === 'INVALID_STATUS', err?.message);
  }

  // --- update(): assignedOwnerId, validated against a real HotelMembership.
  const ownerAssigned = await leads.update(hotelId, manualLead.id, { assignedOwnerId: realUserId });
  check('update() assigns a real owner', ownerAssigned.assignedOwnerId === realUserId, ownerAssigned.assignedOwnerId);

  try {
    await leads.update(hotelId, manualLead.id, { assignedOwnerId: 'user_does_not_exist' });
    check('update() rejects an owner with no membership for this hotel', false, 'expected BadRequestException');
  } catch (err) {
    check('update() rejects an owner with no membership for this hotel', err?.response?.error?.code === 'INVALID_OWNER', err?.message);
  }

  const ownerCleared = await leads.update(hotelId, manualLead.id, { assignedOwnerId: null });
  check('update() clears an owner (explicit null)', ownerCleared.assignedOwnerId === null, String(ownerCleared.assignedOwnerId));

  // --- update(): notes.
  const notesUpdated = await leads.update(hotelId, manualLead.id, { notes: 'Called back, very interested.' });
  check('update() sets notes', notesUpdated.notes === 'Called back, very interested.', notesUpdated.notes);

  const notesCleared = await leads.update(hotelId, manualLead.id, { notes: null });
  check('update() clears notes (explicit null)', notesCleared.notes === null, String(notesCleared.notes));

  // --- get(): unknown id 404s.
  try {
    await leads.get(hotelId, 'not_a_real_id');
    check('get() 404s on an unknown lead id', false, 'expected NotFoundException');
  } catch (err) {
    check('get() 404s on an unknown lead id', err?.response?.error?.code === 'LEAD_NOT_FOUND', err?.message);
  }

  try {
    await leads.update(hotelId, 'not_a_real_id', { status: 'LOST' });
    check('update() 404s on an unknown lead id', false, 'expected NotFoundException');
  } catch (err) {
    check('update() 404s on an unknown lead id', err?.response?.error?.code === 'LEAD_NOT_FOUND', err?.message);
  }

  // --- list(): status filter.
  const qualifiedLead = await leads.createManual(hotelId, { email: 'qualified@example.com' });
  await leads.update(hotelId, qualifiedLead.id, { status: 'QUALIFIED' });

  const qualifiedOnly = await leads.list(hotelId, { status: 'QUALIFIED' });
  check('list(status=QUALIFIED) includes the qualified lead', qualifiedOnly.items.some((l) => l.id === qualifiedLead.id), qualifiedOnly.items.length);
  check('list(status=QUALIFIED) excludes a NEW lead', !qualifiedOnly.items.some((l) => l.id === chatLead.id), qualifiedOnly.items.length);

  try {
    await leads.list(hotelId, { status: 'NOT_A_STATUS' });
    check('list() rejects an invalid status filter', false, 'expected BadRequestException');
  } catch (err) {
    check('list() rejects an invalid status filter', err?.response?.error?.code === 'INVALID_STATUS', err?.message);
  }

  // --- list(): cursor pagination.
  const page1 = await leads.list(hotelId, { limit: 1 });
  check('list(limit=1) returns exactly one item with a nextCursor', page1.items.length === 1 && typeof page1.nextCursor === 'string', JSON.stringify(page1));
  const page2 = await leads.list(hotelId, { limit: 1, cursor: page1.nextCursor });
  check('page 2 (via cursor) returns a different item than page 1', page2.items[0]?.id !== page1.items[0]?.id, `${page1.items[0]?.id} vs ${page2.items[0]?.id}`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
