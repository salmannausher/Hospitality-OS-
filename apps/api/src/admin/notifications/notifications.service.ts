import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NotificationStatus as PrismaNotificationStatus } from '@prisma/client';
import type {
  NotificationStatus,
  NotificationSummary,
  NotificationType,
  Paginated,
} from '@hospitality/types';
import { PrismaService } from '../../common/prisma/prisma.service';

const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED', 'READ'] as const;

export interface ListNotificationsOptions {
  status?: string;
  cursor?: string;
  limit?: number;
}

/** Backs `GET /v1/admin/notifications` + `PATCH .../:id/read` (API §3.7).
 * Unlike every other admin list in this project, this one is scoped to
 * BOTH `hotelId` (RLS/tenant, same as always) AND the calling admin's own
 * `recipientId` — `Notification` is per-user (findings-log.md #21), so an
 * admin only ever sees/marks-read their own rows, never a teammate's. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    hotelId: string,
    recipientId: string,
    opts: ListNotificationsOptions,
  ): Promise<Paginated<NotificationSummary>> {
    const limit = Math.min(opts.limit ?? 50, 100);
    const status = opts.status ? this.requireStatus(opts.status) : undefined;
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.notification.findMany({
        where: { recipientId, ...(status ? { status } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
        this.toSummary(r),
      );
      return { items, nextCursor: hasMore ? rows[limit - 1].id : null };
    });
  }

  /** `PATCH /v1/admin/notifications/:id/read` — the only status transition
   * this project actually performs today (findings-log.md #21: `SENT`/
   * `FAILED` imply an outbound delivery channel that doesn't exist yet). */
  async markRead(
    hotelId: string,
    recipientId: string,
    id: string,
  ): Promise<NotificationSummary> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const existing = await tx.notification.findFirst({
        where: { id, recipientId },
      });
      if (!existing) throw this.notFound(id);
      const updated = await tx.notification.update({
        where: { id },
        data: { status: 'READ' },
      });
      return this.toSummary(updated);
    });
  }

  private requireStatus(value: string): PrismaNotificationStatus {
    if (!NOTIFICATION_STATUSES.includes(value as never)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATUS',
          message: `"status" must be one of: ${NOTIFICATION_STATUSES.join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return value as PrismaNotificationStatus;
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'NOTIFICATION_NOT_FOUND',
        message: `No notification with id "${id}".`,
        requestId: randomUUID(),
      },
    });
  }

  private toSummary(row: {
    id: string;
    type: string;
    payload: unknown;
    status: string;
    createdAt: Date;
  }): NotificationSummary {
    return {
      id: row.id,
      type: row.type as NotificationType,
      payload: row.payload as Record<string, unknown>,
      status: row.status as NotificationStatus,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
