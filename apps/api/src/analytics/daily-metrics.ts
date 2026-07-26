import type { Prisma } from '@prisma/client';

/** Every `DailyMetric` counter that gets bumped incrementally on write
 * (findings-log.md #12) — `avgSatisfaction` is deliberately absent: no
 * capture mechanism for it exists anywhere in the product yet. */
export interface DailyMetricDelta {
  messageCount?: number;
  conversationCount?: number;
  bookingIntentCount?: number;
  leadCount?: number;
  escalationCount?: number;
}

/** `DailyMetric.date` is truncated to a UTC calendar day (DB §13's own "date
 * // truncated to day" comment) — this is the one place that truncation
 * happens, so every caller lands on the same row for "today" regardless of
 * what time within the day it writes. */
export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Increments today's `DailyMetric` row for a hotel, creating it on first
 * write (findings-log.md #12: "computed... incrementally on write" — DB
 * §13's own stated alternative to a batch job, chosen here since no
 * cron/queue infrastructure exists yet and Sprint 4 introduces no new
 * backend concepts). Must be called with a transaction client already bound
 * to `hotelId` via `PrismaService.withTenant` — `DailyMetric` is RLS-scoped
 * like every other tenant table (migration `1_rls_policies`).
 */
export async function bumpDailyMetric(
  tx: Prisma.TransactionClient,
  hotelId: string,
  deltas: DailyMetricDelta,
): Promise<void> {
  const date = startOfUtcDay(new Date());
  await tx.dailyMetric.upsert({
    where: { hotelId_date: { hotelId, date } },
    create: {
      hotelId,
      date,
      messageCount: deltas.messageCount ?? 0,
      conversationCount: deltas.conversationCount ?? 0,
      bookingIntentCount: deltas.bookingIntentCount ?? 0,
      leadCount: deltas.leadCount ?? 0,
      escalationCount: deltas.escalationCount ?? 0,
    },
    update: {
      ...(deltas.messageCount
        ? { messageCount: { increment: deltas.messageCount } }
        : {}),
      ...(deltas.conversationCount
        ? { conversationCount: { increment: deltas.conversationCount } }
        : {}),
      ...(deltas.bookingIntentCount
        ? { bookingIntentCount: { increment: deltas.bookingIntentCount } }
        : {}),
      ...(deltas.leadCount
        ? { leadCount: { increment: deltas.leadCount } }
        : {}),
      ...(deltas.escalationCount
        ? { escalationCount: { increment: deltas.escalationCount } }
        : {}),
    },
  });
}
