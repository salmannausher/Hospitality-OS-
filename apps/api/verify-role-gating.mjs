// Sprint 4, ticket 8 — verify /session, hotel CRUD, and role-gating (API
// §3.1) end to end: hotel resolution via OrganizationMembership (no
// HotelMembership row, findings-log.md #22), authorizeHotelAccess's blanket
// VIEWER-can't-mutate rule (findings-log.md #24), MARKETING can't reassign
// leads (findings-log.md #24), and HotelsService CRUD including the
// AGENCY_ADMIN-only create restriction and the P2002-vs-P2010 slug-conflict
// question (findings-log.md #23). Run `pnpm run build` first.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { LeadsService } = require('./dist/src/leads/leads.service.js');
const { HotelsService } = require('./dist/src/admin/hotels/hotels.service.js');
const {
  authorizeHotelAccess,
} = require('./dist/src/admin/authorize-hotel-access.js');
const { PrismaService } = require('./dist/src/common/prisma/prisma.service.js');

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

// Throwaway rows this script creates, cleaned up in `finally`.
const cleanup = { hotelIds: [], userIds: [], organizationIds: [] };

try {
  const prisma = app.get(PrismaService);
  const leads = app.get(LeadsService);
  const hotelsService = app.get(HotelsService);

  const [{ hotelId: bellevueHotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!bellevueHotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  const bellevue = await prisma.withTenant(bellevueHotelId, (tx) =>
    tx.hotel.findFirstOrThrow({ where: { id: bellevueHotelId } }),
  );

  // A real HotelMembership on Bellevue, to build a leads test fixture against.
  const [membership] = await prisma.withTenant(bellevueHotelId, () =>
    prisma.$queryRaw`SELECT "userId" FROM "HotelMembership" WHERE "hotelId" = ${bellevueHotelId} LIMIT 1`,
  );
  if (!membership) throw new Error('No HotelMembership found for Bellevue — run prisma/seed-admin.mjs first.');
  const bellevueAdminUserId = membership.userId;

  // --- Throwaway fixtures: an org, an agency-admin-only user (no
  // HotelMembership anywhere), and a hotel-admin-only user.
  const org = await prisma.organization.create({
    data: { name: `Verify Org ${randomUUID().slice(0, 8)}` },
  });
  cleanup.organizationIds.push(org.id);

  const agencyUser = await prisma.user.create({
    data: { id: `verify_agency_${randomUUID()}`, email: `agency-${randomUUID()}@example.com` },
  });
  cleanup.userIds.push(agencyUser.id);
  await prisma.organizationMembership.create({
    data: { userId: agencyUser.id, organizationId: org.id, role: 'AGENCY_ADMIN' },
  });

  const plainHotelAdminUser = await prisma.user.create({
    data: { id: `verify_hoteladmin_${randomUUID()}`, email: `hoteladmin-${randomUUID()}@example.com` },
  });
  cleanup.userIds.push(plainHotelAdminUser.id);

  // --- Finding #22: hotel resolution via OrganizationMembership, no
  // HotelMembership row at all.
  const preCreateHotels = await prisma.resolveMemberHotels(agencyUser.id);
  check(
    'Before any hotel exists, an Agency Admin with no HotelMembership resolves to zero hotels (nothing to leak)',
    preCreateHotels.length === 0,
    preCreateHotels.length,
  );

  // --- HotelsService.create(): AGENCY_ADMIN only.
  const slug = `verify-hotel-${randomUUID().slice(0, 8)}`;
  const created = await hotelsService.create(agencyUser.id, {
    name: 'Verify Test Hotel',
    slug,
  });
  cleanup.hotelIds.push(created.id);
  check('create() succeeds for an Agency Admin', created.slug === slug, JSON.stringify(created));

  try {
    await hotelsService.create(plainHotelAdminUser.id, { name: 'Should Fail', slug: 'should-fail' });
    check('create() rejects a non-Agency-Admin caller', false, 'expected ForbiddenException');
  } catch (err) {
    check(
      'create() rejects a non-Agency-Admin caller',
      err?.response?.error?.code === 'FORBIDDEN_ROLE',
      err?.message,
    );
  }

  try {
    await hotelsService.create(agencyUser.id, { name: 'Dup Slug', slug });
    check('create() rejects a duplicate slug', false, 'expected ConflictException');
  } catch (err) {
    check(
      'create() rejects a duplicate slug',
      err?.response?.error?.code === 'SLUG_TAKEN',
      err?.message,
    );
  }

  // --- Now that the hotel exists, resolveMemberHotels/resolveHotelRole pick
  // it up via OrganizationMembership alone.
  const postCreateHotels = await prisma.resolveMemberHotels(agencyUser.id);
  check(
    'resolveMemberHotels finds the new hotel via OrganizationMembership (no HotelMembership row)',
    postCreateHotels.some((h) => h.id === created.id),
    JSON.stringify(postCreateHotels),
  );

  const orgRole = await prisma.resolveHotelRole(agencyUser.id, created.id);
  check('resolveHotelRole reports AGENCY_ADMIN via the org path', orgRole === 'AGENCY_ADMIN', orgRole);

  // --- Direct HotelMembership takes precedence over the org path.
  await prisma.hotelMembership.create({
    data: { userId: agencyUser.id, hotelId: created.id, role: 'VIEWER' },
  });
  const directRole = await prisma.resolveHotelRole(agencyUser.id, created.id);
  check(
    'resolveHotelRole prefers a direct HotelMembership over the org path',
    directRole === 'VIEWER',
    directRole,
  );

  // --- authorizeHotelAccess: VIEWER can read, never mutate.
  const viewerGet = await authorizeHotelAccess(prisma, agencyUser.id, created.id, 'GET');
  check('authorizeHotelAccess allows VIEWER on GET', viewerGet === 'VIEWER', viewerGet);

  for (const method of ['POST', 'PATCH', 'DELETE']) {
    try {
      await authorizeHotelAccess(prisma, agencyUser.id, created.id, method);
      check(`authorizeHotelAccess rejects VIEWER on ${method}`, false, 'expected ForbiddenException');
    } catch (err) {
      check(
        `authorizeHotelAccess rejects VIEWER on ${method}`,
        err?.response?.error?.code === 'FORBIDDEN_ROLE',
        err?.message,
      );
    }
  }

  // Clean up the throwaway VIEWER membership so the rest of the script
  // exercises the org-level AGENCY_ADMIN path again.
  await prisma.hotelMembership.deleteMany({ where: { userId: agencyUser.id, hotelId: created.id } });
  const agencyRoleAgain = await authorizeHotelAccess(prisma, agencyUser.id, created.id, 'PATCH');
  check(
    'authorizeHotelAccess allows AGENCY_ADMIN (org path) on PATCH',
    agencyRoleAgain === 'AGENCY_ADMIN',
    agencyRoleAgain,
  );

  // --- HotelsService.get()/update(), including the slug-conflict path
  // during an UPDATE (a real ORM call, not the raw-SQL create insert).
  const fetched = await hotelsService.get(agencyUser.id, created.id);
  check('get() returns the hotel', fetched.id === created.id, JSON.stringify(fetched));

  const renamed = await hotelsService.update(agencyUser.id, created.id, { name: 'Renamed Verify Hotel' });
  check('update() persists a name change', renamed.name === 'Renamed Verify Hotel', renamed.name);

  try {
    await hotelsService.update(agencyUser.id, created.id, { slug: bellevue.slug });
    check('update() rejects a slug already used by another hotel', false, 'expected ConflictException');
  } catch (err) {
    check(
      'update() rejects a slug already used by another hotel',
      err?.response?.error?.code === 'SLUG_TAKEN',
      err?.message,
    );
  }

  try {
    await hotelsService.update(agencyUser.id, created.id, { name: '' });
    check('update() rejects an empty name', false, 'expected BadRequestException');
  } catch (err) {
    check('update() rejects an empty name', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  // --- list() includes the new hotel for the Agency Admin.
  const listed = await hotelsService.list(agencyUser.id);
  check('list() includes the new hotel', listed.some((h) => h.id === created.id), listed.length);

  // --- Finding #24: MARKETING can't reassign leads; every other field/role
  // combination is unrestricted.
  const newConversation = async () => {
    const id = `c_${randomUUID().replace(/-/g, '')}`;
    await prisma.withTenant(bellevueHotelId, (tx) =>
      tx.conversation.create({ data: { id, hotelId: bellevueHotelId, guestSessionId: `verify_${randomUUID()}` } }),
    );
    return id;
  };
  const conversationId = await newConversation();
  const leadSubmit = await leads.submitAnswer(bellevueHotelId, {
    conversationId,
    promptId: 'lp_verify_role_gating',
    field: 'email',
    value: 'role-gating-verify@example.com',
    consent: true,
  });

  try {
    await leads.update(bellevueHotelId, leadSubmit.leadId, { assignedOwnerId: bellevueAdminUserId }, 'MARKETING');
    check('MARKETING cannot reassign a lead', false, 'expected ForbiddenException');
  } catch (err) {
    check(
      'MARKETING cannot reassign a lead',
      err?.response?.error?.code === 'LEAD_REASSIGN_FORBIDDEN',
      err?.message,
    );
  }

  const marketingStatusUpdate = await leads.update(
    bellevueHotelId,
    leadSubmit.leadId,
    { status: 'CONTACTED' },
    'MARKETING',
  );
  check(
    'MARKETING can still update status/notes (not a reassignment)',
    marketingStatusUpdate.status === 'CONTACTED',
    marketingStatusUpdate.status,
  );

  const hotelAdminReassign = await leads.update(
    bellevueHotelId,
    leadSubmit.leadId,
    { assignedOwnerId: bellevueAdminUserId },
    'HOTEL_ADMIN',
  );
  check(
    'HOTEL_ADMIN can reassign a lead',
    hotelAdminReassign.assignedOwnerId === bellevueAdminUserId,
    hotelAdminReassign.assignedOwnerId,
  );

  const noRoleReassign = await leads.update(bellevueHotelId, leadSubmit.leadId, { assignedOwnerId: null });
  check(
    'update() without a role param (no caller context) is unrestricted',
    noRoleReassign.assignedOwnerId === null,
    String(noRoleReassign.assignedOwnerId),
  );

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  try {
    const prisma = app.get(PrismaService);
    // FK order: memberships (no RLS) before the Users/Organizations/Hotels
    // they reference.
    await prisma.hotelMembership.deleteMany({
      where: { OR: [{ userId: { in: cleanup.userIds } }, { hotelId: { in: cleanup.hotelIds } }] },
    });
    await prisma.organizationMembership.deleteMany({
      where: { OR: [{ userId: { in: cleanup.userIds } }, { organizationId: { in: cleanup.organizationIds } }] },
    });
    for (const hotelId of cleanup.hotelIds) {
      await prisma
        .withTenant(hotelId, (tx) => tx.hotel.delete({ where: { id: hotelId } }))
        .catch(() => {});
    }
    for (const userId of cleanup.userIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    for (const organizationId of cleanup.organizationIds) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    }
  } finally {
    await app.close();
  }
}

process.exit(failures === 0 ? 0 : 1);
