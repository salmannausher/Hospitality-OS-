// Sprint 3, ticket 1 — verify EntitiesService against the live Supabase DB
// (real RLS, real app_role, real Bellevue hotel), the same pattern
// prisma/ingest-bellevue.mjs uses: boot the Nest app context and pull the
// service straight out of DI, bypassing the HTTP/auth layer (no Supabase JWT
// minting harness exists yet). Run `pnpm run build` first.
import 'dotenv/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { EntitiesService } = require('./dist/src/admin/entities/entities.service.js');
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
  const entities = app.get(EntitiesService);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}\n`);

  // 1. INVALID_ENTITY_TYPE guard
  try {
    await entities.list(hotelId, 'not-a-type', {});
    check('unknown :type rejected', false, 'expected BadRequestException');
  } catch (err) {
    check('unknown :type rejected', err?.response?.error?.code === 'INVALID_ENTITY_TYPE', err?.message);
  }

  // 2. MISSING_FIELD guard on create
  try {
    await entities.create(hotelId, 'room-types', { view: 'ocean' });
    check('create rejects missing required field', false, 'expected BadRequestException');
  } catch (err) {
    check('create rejects missing required field', err?.response?.error?.code === 'MISSING_FIELD', err?.message);
  }

  // 3. INVALID_FIELD guard (wrong type)
  try {
    await entities.create(hotelId, 'room-types', { name: 'Verify Suite', capacity: 'four' });
    check('create rejects wrong field type', false, 'expected BadRequestException');
  } catch (err) {
    check('create rejects wrong field type', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  // 4. Real create
  const created = await entities.create(hotelId, 'room-types', {
    name: 'Verify Ocean Suite',
    view: 'ocean',
    capacity: 4,
    accessible: true,
    baseRateLow: 420,
    baseRateHigh: 640,
  });
  check('create returns the persisted row', created.id && created.hotelId === hotelId && created.name === 'Verify Ocean Suite', JSON.stringify(created));

  // 5. Get by id
  const fetched = await entities.get(hotelId, 'room-types', created.id);
  check('get returns the same row', fetched.id === created.id && fetched.capacity === 4, JSON.stringify(fetched));

  // 6. Appears in list
  const listed = await entities.list(hotelId, 'room-types', { limit: 100 });
  check('list includes the created row', listed.items.some((r) => r.id === created.id), `count=${listed.items.length}`);

  // 7. Update (partial)
  const updated = await entities.update(hotelId, 'room-types', created.id, { capacity: 6 });
  check('update applies a partial change', updated.capacity === 6 && updated.name === 'Verify Ocean Suite', JSON.stringify(updated));

  // 8. Search (typeahead) finds it
  const searched = await entities.search(hotelId, { q: 'Verify Ocean', types: ['ROOM_TYPE'] });
  check('search finds the row by name', searched.some((r) => r.id === created.id && r.entityType === 'ROOM_TYPE'), JSON.stringify(searched));

  // 9. Search across all types (no filter) still finds it
  const searchedAll = await entities.search(hotelId, { q: 'Verify Ocean' });
  check('search with no types filter still finds it', searchedAll.some((r) => r.id === created.id), JSON.stringify(searchedAll));

  // 10. Soft delete
  await entities.remove(hotelId, 'room-types', created.id);
  const listedAfterDelete = await entities.list(hotelId, 'room-types', { limit: 100 });
  check('list excludes the soft-deleted row', !listedAfterDelete.items.some((r) => r.id === created.id));

  // 11. Get on soft-deleted row 404s
  try {
    await entities.get(hotelId, 'room-types', created.id);
    check('get 404s on a soft-deleted row', false, 'expected NotFoundException');
  } catch (err) {
    check('get 404s on a soft-deleted row', err?.response?.error?.code === 'ENTITY_NOT_FOUND', err?.message);
  }

  // 12. A second entity type end to end (Policy uses `topic`, not `name`)
  const policy = await entities.create(hotelId, 'policies', {
    topic: 'verify-pets',
    ruleText: 'Pets allowed with a $50 fee, 15kg limit.',
  });
  check('create on a second entity type (policies)', policy.topic === 'verify-pets', JSON.stringify(policy));
  const policySearch = await entities.search(hotelId, { q: 'verify-pets', types: ['POLICY'] });
  check('search matches on the topic field for policies', policySearch.some((r) => r.id === policy.id && r.name === 'verify-pets'), JSON.stringify(policySearch));
  await entities.remove(hotelId, 'policies', policy.id);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
