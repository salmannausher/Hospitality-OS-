import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { startOfUtcDay } from '../../analytics/daily-metrics';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { AnalyticsService } from './analytics.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Default window when `from` is omitted — enough for the Dashboard's KPI
 * tiles (today) plus a short recent trend, without requiring the caller to
 * always specify a range explicitly. */
const DEFAULT_WINDOW_DAYS = 30;
/** UX §12's own literal "this week" (findings-log.md #20) — the Missing
 * Information panel's default window, overridable via `from`/`to`. */
const DEFAULT_GAP_WINDOW_DAYS = 7;

/** `GET /v1/admin/analytics/daily?from=&to=` (API §3.6). No role beyond
 * "authenticated + hotel-scoped" is called out for Analytics specifically
 * (unlike brand/prompts/knowledge/users, which explicitly require HOTEL_ADMIN+
 * — API §1) — VIEWER-and-up read access, same guard pair as every other
 * hotel-scoped admin route. */
@Controller('v1/admin/analytics')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('daily')
  async daily(
    @CurrentHotelId() hotelId: string,
    @Query('from') fromParam?: string,
    @Query('to') toParam?: string,
  ) {
    const to = this.parseDate('to', toParam) ?? startOfUtcDay(new Date());
    const from =
      this.parseDate('from', fromParam) ??
      new Date(to.getTime() - (DEFAULT_WINDOW_DAYS - 1) * MS_PER_DAY);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_RANGE',
          message: '"from" must not be after "to".',
          requestId: randomUUID(),
        },
      });
    }

    return this.analytics.getDaily(hotelId, from, to);
  }

  @Get('topics')
  async topics(@CurrentHotelId() hotelId: string) {
    return this.analytics.getTopics(hotelId);
  }

  @Get('gaps')
  async gaps(
    @CurrentHotelId() hotelId: string,
    @Query('from') fromParam?: string,
    @Query('to') toParam?: string,
  ) {
    // Not `parseDate`/`startOfUtcDay` — `gaps` compares against raw
    // `Message.createdAt` timestamps, not a day-bucketed rollup like
    // `daily`'s `DailyMetric.date`, so truncating `to` to midnight would
    // silently exclude that day's own messages.
    const to = this.parseDateTime('to', toParam) ?? new Date();
    const from =
      this.parseDateTime('from', fromParam) ??
      new Date(to.getTime() - DEFAULT_GAP_WINDOW_DAYS * MS_PER_DAY);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_RANGE',
          message: '"from" must not be after "to".',
          requestId: randomUUID(),
        },
      });
    }

    return this.analytics.getGaps(hotelId, from, to);
  }

  private parseDateTime(name: string, value?: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_DATE',
          message: `"${name}" must be a valid date, got "${value}".`,
          requestId: randomUUID(),
        },
      });
    }
    return parsed;
  }

  private parseDate(name: string, value?: string): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_DATE',
          message: `"${name}" must be a valid date, got "${value}".`,
          requestId: randomUUID(),
        },
      });
    }
    return startOfUtcDay(parsed);
  }
}
