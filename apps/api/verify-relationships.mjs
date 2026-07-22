// Sprint 3, ticket 2 — verify RelationshipsService + CardAssemblyService
// against the live Supabase DB and the seeded Bellevue hotel, same pattern as
// verify-entities.mjs: boot the Nest app context and pull services straight
// out of DI. Run `pnpm run build` first.
import 'dotenv/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { RelationshipsService } = require('./dist/src/admin/relationships/relationships.service.js');
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
  const relationships = app.get(RelationshipsService);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');

  const [roomType, restaurant, spa] = await prisma.withTenant(hotelId, async (tx) => {
    const [rt] = await tx.roomType.findMany({ where: { deletedAt: null }, take: 1 });
    const [r] = await tx.restaurant.findMany({ where: { deletedAt: null }, take: 1 });
    const [s] = await tx.spaTreatment.findMany({ where: { deletedAt: null }, take: 1 });
    return [rt, r, s];
  });
  if (!roomType || !restaurant || !spa) throw new Error('Expected seeded RoomType/Restaurant/SpaTreatment rows — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}`);
  console.log(`  roomType=${roomType.name} (${roomType.id})`);
  console.log(`  restaurant=${restaurant.name} (${restaurant.id})`);
  console.log(`  spa=${spa.name} (${spa.id})\n`);

  const TAG = 'verify-anniversary';
  const created = [];

  // 1. MISSING_FIELD guard
  try {
    await relationships.create(hotelId, { fromEntityType: 'ROOM_TYPE', fromEntityId: roomType.id });
    check('create rejects missing required fields', false, 'expected BadRequestException');
  } catch (err) {
    check('create rejects missing required fields', err?.response?.error?.code === 'MISSING_FIELD', err?.message);
  }

  // 2. INVALID_ENTITY_TYPE guard
  try {
    await relationships.create(hotelId, {
      fromEntityType: 'NOT_A_TYPE', fromEntityId: roomType.id,
      toEntityType: 'RESTAURANT', toEntityId: restaurant.id,
      relationshipType: 'pairs_with', contextTag: TAG,
    });
    check('create rejects unknown entity type', false, 'expected BadRequestException');
  } catch (err) {
    check('create rejects unknown entity type', err?.response?.error?.code === 'INVALID_ENTITY_TYPE', err?.message);
  }

  // 3. ENTITY_NOT_FOUND guard (no FK constraint — app-layer validation, per the schema comment)
  try {
    await relationships.create(hotelId, {
      fromEntityType: 'ROOM_TYPE', fromEntityId: 'does-not-exist',
      toEntityType: 'RESTAURANT', toEntityId: restaurant.id,
      relationshipType: 'pairs_with', contextTag: TAG,
    });
    check('create rejects a non-existent entity id', false, 'expected BadRequestException');
  } catch (err) {
    check('create rejects a non-existent entity id', err?.response?.error?.code === 'ENTITY_NOT_FOUND', err?.message);
  }

  // 4. INVALID_FIELD guard on priority
  try {
    await relationships.create(hotelId, {
      fromEntityType: 'ROOM_TYPE', fromEntityId: roomType.id,
      toEntityType: 'RESTAURANT', toEntityId: restaurant.id,
      relationshipType: 'pairs_with', contextTag: TAG, priority: 'URGENT',
    });
    check('create rejects an invalid priority', false, 'expected BadRequestException');
  } catch (err) {
    check('create rejects an invalid priority', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  // 5. Real creates — build the anniversary bundle from IA §12's own example
  const edge1 = await relationships.create(hotelId, {
    fromEntityType: 'ROOM_TYPE', fromEntityId: roomType.id,
    toEntityType: 'RESTAURANT', toEntityId: restaurant.id,
    relationshipType: 'pairs_with', contextTag: TAG, priority: 'HIGH',
  });
  created.push(edge1.id);
  check('create persists edge 1 (room type <-> restaurant)', edge1.id && edge1.contextTag === TAG, JSON.stringify(edge1));

  const edge2 = await relationships.create(hotelId, {
    fromEntityType: 'ROOM_TYPE', fromEntityId: roomType.id,
    toEntityType: 'SPA_TREATMENT', toEntityId: spa.id,
    relationshipType: 'pairs_with', contextTag: TAG,
  });
  created.push(edge2.id);
  check('create persists edge 2 (room type <-> spa), defaults priority to NORMAL', edge2.priority === 'NORMAL', JSON.stringify(edge2));

  // 6. Get by id
  const fetched = await relationships.get(hotelId, edge1.id);
  check('get returns the same row', fetched.id === edge1.id, JSON.stringify(fetched));

  // 7. List filtered by contextTag finds both
  const listed = await relationships.list(hotelId, { contextTag: TAG, limit: 100 });
  check('list filtered by contextTag finds both edges', listed.items.filter((r) => created.includes(r.id)).length === 2, `count=${listed.items.length}`);

  // 8. List with a different contextTag finds neither
  const listedOther = await relationships.list(hotelId, { contextTag: 'verify-nonexistent-tag', limit: 100 });
  check('list with an unrelated contextTag finds none of the created edges', !listedOther.items.some((r) => created.includes(r.id)));

  // 9. Preview — the real card-assembly path, deduped across both edges
  const preview = await relationships.preview(hotelId, TAG);
  check('preview returns a "card" event', preview.type === 'card', JSON.stringify(preview));
  check('preview includes the room type, restaurant, and spa treatment (deduped)', preview.cards.length === 3, JSON.stringify(preview.cards));
  const roomCard = preview.cards.find((c) => c.entityId === roomType.id);
  check('preview room-type card has the right title', roomCard?.title === roomType.name, JSON.stringify(roomCard));
  check('preview room-type card has a non-empty templated hook', typeof roomCard?.hook === 'string' && roomCard.hook.length > 0, JSON.stringify(roomCard));
  const spaIndex = preview.cards.findIndex((c) => c.entityId === spa.id);
  const roomIndex = preview.cards.findIndex((c) => c.entityId === roomType.id);
  const restaurantIndex = preview.cards.findIndex((c) => c.entityId === restaurant.id);
  check(
    'preview orders the HIGH-priority edge (room type + restaurant) before the NORMAL one (spa)',
    spaIndex > roomIndex && spaIndex > restaurantIndex,
    JSON.stringify(preview.cards.map((c) => c.entityId)),
  );

  // 10. Preview on an unrelated tag returns an empty bundle, not an error
  const emptyPreview = await relationships.preview(hotelId, 'verify-nonexistent-tag');
  check('preview on an unrelated contextTag returns an empty card list', emptyPreview.type === 'card' && emptyPreview.cards.length === 0, JSON.stringify(emptyPreview));

  // 11. Remove (hard delete — no deletedAt on this model) + it disappears
  await relationships.remove(hotelId, edge1.id);
  await relationships.remove(hotelId, edge2.id);
  const listedAfterDelete = await relationships.list(hotelId, { contextTag: TAG, limit: 100 });
  check('list excludes removed edges', !listedAfterDelete.items.some((r) => created.includes(r.id)));

  try {
    await relationships.get(hotelId, edge1.id);
    check('get 404s on a removed relationship', false, 'expected NotFoundException');
  } catch (err) {
    check('get 404s on a removed relationship', err?.response?.error?.code === 'RELATIONSHIP_NOT_FOUND', err?.message);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
