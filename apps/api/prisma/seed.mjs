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
//
// Trimmed to just the one genuine gap real ingestion doesn't cover
// (findings-log.md #29) — every other fact this array used to hand-enter
// (breakfast, pets, Ocean View Suite pricing, a "Garden Family Room" that
// matched no real room, spa pricing, a "The Terrace" restaurant that matched
// neither real one) has since been superseded by the real content in
// prisma/content/bellevue/*, and had silently drifted out of sync with it —
// guests were getting factually wrong answers whenever retrieval picked the
// stale seed chunk over the real one. Never re-add a fact here that a real
// content file already covers.
const CHUNKS = [
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
    // primaryColor/fontFamily are real content decisions (docs/08 §2, findings-log.md
    // #25/#26 — brass + Cormorant Garamond, matching apps/demo-bellevue/globals.css),
    // synced on every reseed rather than frozen at first-create like the rest of the row.
    update: { primaryColor: '#93702f', fontFamily: 'Cormorant Garamond' },
    create: {
      hotelId: hotel.id,
      conciergeName: 'The Bellevue Concierge',
      tonePreset: 'CLASSIC_LUXURY',
      greeting: 'Welcome to Bellevue Hotel. I’m the Bellevue Concierge — how may I help you today?',
      primaryColor: '#93702f',
      fontFamily: 'Cormorant Garamond',
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

  // A single structured RoomType, matching the real rooms.md rate exactly
  // (findings-log.md #29 — this used to hand-enter a second, fictional
  // "Garden Family Room," plus a Restaurant and two Policy rows that all
  // drifted out of sync with the real content in prisma/content/bellevue/*
  // once it existed; ingest-bellevue.mjs is the authoritative source for
  // Restaurant/Policy/the rest of RoomType now, not this script).
  await prisma.roomType.createMany({
    data: [
      { hotelId: hotel.id, name: 'Ocean View Suite', view: 'Sea', capacity: 2, bedConfig: 'King', baseRateLow: 750, baseRateHigh: 950 },
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
        ("id","hotelId","documentId","domainTags","sourceType","language","priority","isAtomic","lastVerifiedAt","content","embedding")
      VALUES
        (${randomUUID()}, ${hotel.id}, ${doc.id}, ${c.domainTags}::text[], ${'TEXT'}::"DocumentSourceType",
         'en', ${c.priority}::"Priority", false, now(), ${c.content}, ${literal}::vector)
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
