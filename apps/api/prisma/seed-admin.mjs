// Provisions one test HOTEL_ADMIN for the Bellevue demo hotel — reproducible,
// not a one-off REPL session. Idempotent: finds-or-creates the Supabase Auth
// user, then upserts the matching User + HotelMembership rows.
//
// User.id is deliberately the Supabase Auth provider's own id (docs/07-database-design.md
// §1: "User.id here is the provider's user id, not a locally-owned credential
// record") — GET /v1/admin/session looks users up by this exact primary key.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

const EMAIL = 'admin@bellevue-demo.test';
const HOTEL_SLUG = 'bellevue-hotel';

async function findOrCreateSupabaseUser() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  // Supabase's admin API has no "get by email" endpoint pre-v2-filters; list
  // and filter client-side (fine at this scale — this is a dev provisioning
  // script, not a runtime path).
  const listRes = await fetch(`${url}/auth/v1/admin/users`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  const { users } = await listRes.json();
  const existing = users?.find((u) => u.email === EMAIL);
  if (existing) return { id: existing.id, created: false };

  const password = `Test-Admin-${Math.random().toString(36).slice(2, 10)}!9`;
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password, email_confirm: true }),
  });
  if (!createRes.ok) throw new Error(`Failed to create Supabase user: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json();
  return { id: created.id, created: true, password };
}

async function main() {
  const { id, created, password } = await findOrCreateSupabaseUser();

  const hotel = await prisma.hotel.findUniqueOrThrow({ where: { slug: HOTEL_SLUG } });

  await prisma.user.upsert({
    where: { id },
    update: { email: EMAIL },
    create: { id, email: EMAIL, name: 'Bellevue Test Admin' },
  });

  await prisma.hotelMembership.upsert({
    where: { userId_hotelId: { userId: id, hotelId: hotel.id } },
    update: { role: 'HOTEL_ADMIN' },
    create: { userId: id, hotelId: hotel.id, role: 'HOTEL_ADMIN' },
  });

  console.log(`Provisioned admin ${EMAIL} (id ${id}) as HOTEL_ADMIN on ${hotel.name}.`);
  if (created) {
    console.log(`New Supabase Auth user created. Password (dev/test only): ${password}`);
  } else {
    console.log('Supabase Auth user already existed — password unchanged.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
