import { Injectable } from '@nestjs/common';
import type { DailyMetricRow } from '@hospitality/types';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Backs `GET /v1/admin/analytics/daily` (API §3.6) — reads the `DailyMetric`
 * rollups findings-log.md #12 wires every write path to maintain, never a
 * live `COUNT`/`GROUP BY` over `Message`/`Conversation`/`Lead` (DB §13's own
 * stated reason: that doesn't scale past "1,000+ hotels", PRD §17). */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDaily(
    hotelId: string,
    from: Date,
    to: Date,
  ): Promise<DailyMetricRow[]> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.dailyMetric.findMany({
        where: { date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
      });
      return rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        messageCount: r.messageCount,
        conversationCount: r.conversationCount,
        bookingIntentCount: r.bookingIntentCount,
        leadCount: r.leadCount,
        escalationCount: r.escalationCount,
        avgSatisfaction: r.avgSatisfaction,
      }));
    });
  }
}
