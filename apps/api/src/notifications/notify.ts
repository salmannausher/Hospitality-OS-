import type { Prisma } from '@prisma/client';
import type { NotificationType } from '@hospitality/types';

/**
 * Creates one `Notification` row per `HotelMembership` for `hotelId` (API
 * §3.7) — the schema has no group/broadcast concept on `Notification`
 * itself (`recipientId` is a single `User.id`), so every member of the
 * hotel is notified regardless of role; there's no documented rule saying
 * e.g. "MARKETING doesn't need escalation alerts" to filter by
 * (findings-log.md #21). Always created as `PENDING` — `SENT`/`FAILED`
 * imply an outbound delivery channel (email/push) that doesn't exist yet;
 * the only real transition is an admin marking one `READ` in the portal.
 *
 * Must be called with a transaction client already bound to `hotelId` via
 * `PrismaService.withTenant`, same convention as `bumpDailyMetric` —
 * `Notification` is RLS-scoped like every other tenant table.
 * `HotelMembership` itself carries no RLS predicate (migration
 * `1_rls_policies`'s explicit exception), so querying it inside a
 * tenant-scoped transaction is safe but not RLS-filtered by this call.
 */
export async function notifyHotelMembers(
  tx: Prisma.TransactionClient,
  hotelId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
): Promise<void> {
  const members = await tx.hotelMembership.findMany({
    where: { hotelId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await tx.notification.createMany({
    data: members.map((m) => ({
      hotelId,
      type,
      recipientId: m.userId,
      payload: payload as Prisma.InputJsonValue,
    })),
  });
}
