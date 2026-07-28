// Sprint 4, ticket 4 — verify the Brand Settings surface (API §3.5) end to
// end: get()/update(), field validation, and the WCAG AA contrast check
// (findings-log.md #17 — primaryColor/secondaryColor checked as button
// background colors against white foreground text, 4.5:1). Captures
// Bellevue's real seeded settings first and restores them at the end, since
// this hits the real live database, not a fixture.
//
// NOT covered here: the "brand-new hotel with zero BrandSettings rows"
// default-fallback path (BrandSettingsService.toResponse's null branch).
// Hotel itself is RLS-scoped (the same reason resolve_widget_key/
// admin_hotels_for_user exist as SECURITY DEFINER functions) — safely
// creating a throwaway Hotel row through the runtime app_role connection
// this script uses isn't practical, and deleting Bellevue's real seeded row
// to test it would break every other verify script that depends on its
// tonePreset/bookingEngineUrl/groupInquiryThreshold. That branch is
// deterministic, reviewed code (mirrors ChatService.bootstrap's own
// fallback defaults exactly), not exercised live.
// Run `pnpm run build` first.
import 'dotenv/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/src/app.module.js');
const { BrandSettingsService } = require('./dist/src/admin/brand/brand-settings.service.js');
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
  const brand = app.get(BrandSettingsService);

  const [{ hotelId }] = await prisma.$queryRaw`
    SELECT resolve_widget_key('wk_demo_bellevue') AS "hotelId"
  `;
  if (!hotelId) throw new Error('Bellevue hotel not found — run prisma/seed.mjs first.');
  console.log(`Using hotel ${hotelId}\n`);

  const original = await brand.get(hotelId);
  check('get() returns real seeded settings, not defaults', original.updatedAt !== null, JSON.stringify(original));

  // --- A valid, passing update.
  const renamed = await brand.update(hotelId, { conciergeName: 'Verify Concierge' });
  check('update() persists a changed field', renamed.conciergeName === 'Verify Concierge', renamed.conciergeName);
  check('update() bumps updatedAt', renamed.updatedAt !== original.updatedAt, `${original.updatedAt} -> ${renamed.updatedAt}`);

  // --- Hex format validation.
  try {
    await brand.update(hotelId, { primaryColor: 'not-a-color' });
    check('update() rejects a non-hex primaryColor', false, 'expected BadRequestException');
  } catch (err) {
    check('update() rejects a non-hex primaryColor', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  // --- WCAG AA contrast: a single failing color.
  try {
    await brand.update(hotelId, { primaryColor: '#FFFF66' });
    check('update() rejects a low-contrast primaryColor', false, 'expected 422 CONTRAST_FAILURE');
  } catch (err) {
    const body = err?.response?.error;
    check('update() rejects a low-contrast primaryColor', body?.code === 'CONTRAST_FAILURE', err?.message);
    check('CONTRAST_FAILURE names the failing field/color', body?.details?.[0]?.field === 'primaryColor' && body?.details?.[0]?.color === '#FFFF66', JSON.stringify(body?.details));
    check('CONTRAST_FAILURE reports a real ratio below the 4.5 requirement', body?.details?.[0]?.ratio < 4.5 && body?.details?.[0]?.required === 4.5, JSON.stringify(body?.details));
  }

  // --- WCAG AA contrast: both colors failing at once, both named.
  try {
    await brand.update(hotelId, { primaryColor: '#FFFF66', secondaryColor: '#FFCCCC' });
    check('update() rejects when both colors fail contrast', false, 'expected 422 CONTRAST_FAILURE');
  } catch (err) {
    const details = err?.response?.error?.details ?? [];
    const fields = details.map((d) => d.field).sort();
    check('update() names BOTH failing colors, not just the first', JSON.stringify(fields) === JSON.stringify(['primaryColor', 'secondaryColor']), JSON.stringify(fields));
  }

  // --- A passing color update actually saves.
  const colored = await brand.update(hotelId, { primaryColor: '#1A1A2E' });
  check('update() accepts a real passing primaryColor', colored.primaryColor === '#1A1A2E', colored.primaryColor);

  // --- tonePreset / groupInquiryThreshold validation.
  try {
    await brand.update(hotelId, { tonePreset: 'NOT_A_PRESET' });
    check('update() rejects an invalid tonePreset', false, 'expected BadRequestException');
  } catch (err) {
    check('update() rejects an invalid tonePreset', err?.response?.error?.code === 'INVALID_TONE_PRESET', err?.message);
  }

  try {
    await brand.update(hotelId, { groupInquiryThreshold: 0 });
    check('update() rejects a non-positive groupInquiryThreshold', false, 'expected BadRequestException');
  } catch (err) {
    check('update() rejects a non-positive groupInquiryThreshold', err?.response?.error?.code === 'INVALID_FIELD', err?.message);
  }

  // --- Clearing a nullable field with an explicit null.
  await brand.update(hotelId, { signOff: 'Warmly, the team' });
  const cleared = await brand.update(hotelId, { signOff: null });
  check('update() clears a nullable field with explicit null', cleared.signOff === null, String(cleared.signOff));

  // --- Restore Bellevue's original settings so no other verify script regresses.
  const restored = await brand.update(hotelId, {
    conciergeName: original.conciergeName,
    tonePreset: original.tonePreset,
    formalityNote: original.formalityNote,
    emojiAllowed: original.emojiAllowed,
    signOff: original.signOff,
    greeting: original.greeting,
    logoUrl: original.logoUrl,
    primaryColor: original.primaryColor,
    secondaryColor: original.secondaryColor,
    fontFamily: original.fontFamily,
    bookingEngineUrl: original.bookingEngineUrl,
    groupInquiryThreshold: original.groupInquiryThreshold,
  });
  check(
    'Bellevue\'s original settings are fully restored',
    restored.conciergeName === original.conciergeName &&
      restored.tonePreset === original.tonePreset &&
      restored.primaryColor === original.primaryColor &&
      restored.groupInquiryThreshold === original.groupInquiryThreshold &&
      restored.bookingEngineUrl === original.bookingEngineUrl,
    JSON.stringify({ restored, original }),
  );

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
} finally {
  await app.close();
}

process.exit(failures === 0 ? 0 : 1);
