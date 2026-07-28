import { Injectable } from '@nestjs/common';
import type {
  DailyMetricRow,
  Domain,
  MissingInformationGap,
  TopicDistributionRow,
} from '@hospitality/types';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Plain per-domain phrase, not content-aware — the classifier's `domain`
 * output (IA §2's 8-value taxonomy) is the finest signal that exists
 * anywhere in the pipeline, coarser than UX §12's own mockup examples
 * ("Pet Policy," "Airport Transfer") — findings-log.md #20. */
const DOMAIN_RECOMMENDED_ACTIONS: Record<Domain, string> = {
  accommodation: 'Add more detail to your room type descriptions',
  booking: 'Review your booking and cancellation policies',
  dining: 'Upload your restaurant menus',
  spa: 'Upload your spa menu',
  property: 'Add property amenity details',
  local_area: 'Add local area recommendations',
  policies: 'Add a policy document',
  events: 'Upload your event space details',
};

/** UX §12's "repeated" (not a one-off) — undocumented exact number, a
 * judgment call (findings-log.md #20). The default time window itself
 * ("this week") is the controller's concern, same as `getDaily`'s `from`/`to`
 * defaulting. */
const MIN_GAP_COUNT = 2;

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

  /** `GET /v1/admin/analytics/topics` (UX §12 "Guests Ask Most About") — the
   * `domainTags` distribution of real conversations. Deliberately counts
   * CONVERSATIONS a domain appeared in at least once, not raw message
   * occurrences (API §3.6's own wording: "distribution of real
   * conversations") — a guest asking five spa questions in one conversation
   * counts once toward `spa`, not five times. No rollup table backs this
   * (unlike `daily`) — there's no established aggregation pattern in this
   * codebase for a `String[]` column (Prisma can't `groupBy` on it), so this
   * is a live `findMany` + in-memory tally, the same idiom
   * `ConversationsService.toSummary` already uses for `domainTags`. */
  async getTopics(hotelId: string): Promise<TopicDistributionRow[]> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.message.findMany({
        select: { conversationId: true, domainTags: true },
      });
      const domainsByConversation = new Map<string, Set<string>>();
      for (const row of rows) {
        const domains =
          domainsByConversation.get(row.conversationId) ?? new Set<string>();
        for (const domain of row.domainTags) domains.add(domain);
        domainsByConversation.set(row.conversationId, domains);
      }
      const counts = new Map<string, number>();
      for (const domains of domainsByConversation.values()) {
        for (const domain of domains) {
          counts.set(domain, (counts.get(domain) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .map(([domain, count]) => ({ domain: domain as Domain, count }))
        .sort((a, b) => b.count - a.count);
    });
  }

  /** `GET /v1/admin/analytics/gaps` (UX §12 "Missing Information") — domains
   * with repeated LOW-confidence turns. Unlike `getTopics`, this counts raw
   * message occurrences ("12 Low-Confidence **answers**"), not deduped
   * conversations — a domain that keeps failing across many turns of the
   * SAME conversation is exactly the repeated-failure signal this panel
   * exists to surface. */
  async getGaps(
    hotelId: string,
    from: Date,
    to: Date,
  ): Promise<MissingInformationGap[]> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.message.findMany({
        where: {
          confidenceBand: 'LOW',
          createdAt: { gte: from, lte: to },
        },
        select: { domainTags: true },
      });
      const counts = new Map<string, number>();
      for (const row of rows) {
        for (const domain of row.domainTags) {
          counts.set(domain, (counts.get(domain) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .filter(([, count]) => count >= MIN_GAP_COUNT)
        .map(([domain, count]) => ({
          domain: domain as Domain,
          lowConfidenceCount: count,
          recommendedAction:
            DOMAIN_RECOMMENDED_ACTIONS[domain as Domain] ??
            `Add more content covering ${domain}`,
        }))
        .sort((a, b) => b.lowConfidenceCount - a.lowConfidenceCount);
    });
  }
}
