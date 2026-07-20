// Sprint 1 seed — one hotel with hand-entered content, standing in for real
// ingestion (which is Sprint 2). Creates the Bellevue demo hotel, brand, a
// widget key, a few structured entities, and a set of knowledge Chunks embedded
// via Voyage so the retrieval pipeline has something real to find.
//
// Runs as the OWNER connection (DIRECT_URL / postgres) — table owners bypass
// RLS, which is exactly what seeding needs. The runtime path (app_role,
// DATABASE_URL) is the RLS-enforced one; never seed through that.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

const SLUG = 'bellevue-hotel';
const WIDGET_KEY = 'wk_demo_bellevue';

// Knowledge chunks — content, domain tags, priority. This is the "hand-entered
// content" the Sprint 1 pipeline is proven against.
const CHUNKS = [
  { content: 'Breakfast is served daily from 6:30 AM to 10:30 AM in The Terrace restaurant, with both à la carte and buffet options.', domainTags: ['dining', 'policies'], priority: 'NORMAL' },
  { content: 'The Bellevue is pet-friendly. Dogs up to 15kg are welcome for a cleaning fee of $50 per stay; please notify us in advance.', domainTags: ['policies'], priority: 'HIGH' },
  { content: 'The Ocean View Suite sleeps two guests, features a king bed and a private balcony overlooking the sea, and starts at $480 per night.', domainTags: ['accommodation'], priority: 'NORMAL' },
  { content: 'The Garden Family Room sleeps four with two queen beds and can connect to an adjoining room on request — ideal for families.', domainTags: ['accommodation'], priority: 'NORMAL' },
  { content: 'Check-in is from 3:00 PM and check-out is by 11:00 AM. Early check-in and late check-out are offered subject to availability.', domainTags: ['policies'], priority: 'HIGH' },
  { content: 'The Spa at Bellevue offers a 60-minute deep-tissue massage for $140 and a 90-minute signature facial for $180. Please book a day ahead.', domainTags: ['spa'], priority: 'NORMAL' },
  { content: 'The Terrace serves Mediterranean cuisine with a smart-casual dress code; dinner reservations are recommended.', domainTags: ['dining'], priority: 'NORMAL' },
  { content: 'Complimentary high-speed Wi-Fi is available throughout the property, including all guest rooms and meeting spaces.', domainTags: ['property', 'policies'], priority: 'NORMAL' },
];

async function embed(texts) {
  // The sandbox's per-process DNS is intermittent here; retry transient failures.
  let lastErr;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'voyage-4', input: texts, input_type: 'document' }),
      });
      if (!res.ok) throw new Error(`Voyage failed: ${res.status} ${await res.text()}`);
      const json = await res.json();
      return json.data.map((d) => d.embedding);
    } catch (err) {
      lastErr = err;
      console.warn(`  embed attempt ${attempt} failed (${err.cause?.code ?? err.message}); retrying…`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'org_demo' },
    update: {},
    create: { id: 'org_demo', name: 'Spherical (Demo)' },
  });

  const hotel = await prisma.hotel.upsert({
    where: { slug: SLUG },
    update: { name: 'Bellevue Hotel' },
    create: { organizationId: org.id, name: 'Bellevue Hotel', slug: SLUG },
  });

  await prisma.brandSettings.upsert({
    where: { hotelId: hotel.id },
    update: {},
    create: {
      hotelId: hotel.id,
      conciergeName: 'The Bellevue Concierge',
      tonePreset: 'CLASSIC_LUXURY',
      greeting: 'Welcome to Bellevue Hotel. I’m the Bellevue Concierge — how may I help you today?',
      primaryColor: '#2F4A3C',
    },
  });

  await prisma.widgetKey.upsert({
    where: { key: WIDGET_KEY },
    update: { revoked: false },
    create: { hotelId: hotel.id, key: WIDGET_KEY },
  });

  // Reset knowledge + entities so re-running the seed is idempotent.
  await prisma.$executeRaw`DELETE FROM "Chunk" WHERE "hotelId" = ${hotel.id}`;
  await prisma.document.deleteMany({ where: { hotelId: hotel.id } });
  await prisma.roomType.deleteMany({ where: { hotelId: hotel.id } });
  await prisma.restaurant.deleteMany({ where: { hotelId: hotel.id } });
  await prisma.policy.deleteMany({ where: { hotelId: hotel.id } });

  // A few structured entities (the ticket's hand-entered RoomType/Restaurant/Policy).
  await prisma.roomType.createMany({
    data: [
      { hotelId: hotel.id, name: 'Ocean View Suite', view: 'Sea', capacity: 2, bedConfig: 'King', baseRateLow: 480 },
      { hotelId: hotel.id, name: 'Garden Family Room', view: 'Garden', capacity: 4, bedConfig: 'Two Queen' },
    ],
  });
  await prisma.restaurant.create({
    data: { hotelId: hotel.id, name: 'The Terrace', cuisine: 'Mediterranean', hours: '18:00–22:30', dressCode: 'Smart casual' },
  });
  await prisma.policy.createMany({
    data: [
      { hotelId: hotel.id, topic: 'pets', ruleText: 'Dogs up to 15kg welcome for a $50 cleaning fee per stay.' },
      { hotelId: hotel.id, topic: 'check-in', ruleText: 'Check-in from 3:00 PM, check-out by 11:00 AM.' },
    ],
  });

  // The knowledge document + embedded chunks.
  const doc = await prisma.document.create({
    data: { hotelId: hotel.id, filename: 'bellevue-seed.txt', sourceType: 'TEXT', storageUrl: 'seed://bellevue', status: 'INDEXED' },
  });

  const vectors = await embed(CHUNKS.map((c) => c.content));
  for (let i = 0; i < CHUNKS.length; i++) {
    const c = CHUNKS[i];
    const literal = `[${vectors[i].join(',')}]`;
    await prisma.$executeRaw`
      INSERT INTO "Chunk"
        ("id","hotelId","documentId","domainTags","sourceType","language","priority","lastVerifiedAt","content","embedding")
      VALUES
        (${randomUUID()}, ${hotel.id}, ${doc.id}, ${c.domainTags}::text[], ${'TEXT'}::"DocumentSourceType",
         'en', ${c.priority}::"Priority", now(), ${c.content}, ${literal}::vector)
    `;
  }

  console.log(`Seeded hotel ${hotel.id} (${SLUG}), widget key ${WIDGET_KEY}, ${CHUNKS.length} chunks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
