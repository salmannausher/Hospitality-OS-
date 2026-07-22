// Seeds the real `anniversary` relationship bundle for the Bellevue demo hotel
// (IA §12's own worked example, reused verbatim by Playbook G-05: "Ocean
// Suite + Rooftop Restaurant + Couples Massage"). Without this, G-05 has
// nothing to retrieve — the card-assembly code (Sprint 3 ticket 2/3) is
// correct but empty without a curated bundle behind it.
//
// Runs as the OWNER connection (DIRECT_URL / postgres) — same as seed.mjs —
// because seeding is a one-time content-authoring operation, not the RLS-
// enforced runtime path. Idempotent: clears this hotel's `anniversary` edges
// before recreating them, so re-running never duplicates.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const SLUG = 'bellevue-hotel';
const CONTEXT_TAG = 'anniversary';

async function main() {
  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { slug: SLUG } });

  const roomType = await prisma.roomType.findFirstOrThrow({
    where: { hotelId: hotel.id, name: 'Ocean View Suite', deletedAt: null },
  });
  const restaurant = await prisma.restaurant.findFirstOrThrow({
    where: { hotelId: hotel.id, name: 'The Rooftop at Bellevue', deletedAt: null },
  });
  const spa = await prisma.spaTreatment.findFirstOrThrow({
    where: { hotelId: hotel.id, name: 'Couples Massage', deletedAt: null },
  });

  await prisma.entityRelationship.deleteMany({
    where: { hotelId: hotel.id, contextTag: CONTEXT_TAG },
  });

  await prisma.entityRelationship.createMany({
    data: [
      {
        hotelId: hotel.id,
        fromEntityType: 'ROOM_TYPE',
        fromEntityId: roomType.id,
        toEntityType: 'RESTAURANT',
        toEntityId: restaurant.id,
        relationshipType: 'pairs_with',
        contextTag: CONTEXT_TAG,
        priority: 'HIGH',
      },
      {
        hotelId: hotel.id,
        fromEntityType: 'ROOM_TYPE',
        fromEntityId: roomType.id,
        toEntityType: 'SPA_TREATMENT',
        toEntityId: spa.id,
        relationshipType: 'pairs_with',
        contextTag: CONTEXT_TAG,
        priority: 'HIGH',
      },
    ],
  });

  console.log(
    `Seeded "${CONTEXT_TAG}" bundle for ${hotel.name}: ${roomType.name} + ${restaurant.name} + ${spa.name}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
