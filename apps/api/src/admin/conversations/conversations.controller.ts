import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FlagForPlaybookRequest } from '@hospitality/types';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentSupabaseUser } from '../../auth/current-supabase-user.decorator';
import type { SupabaseUser } from '../../auth/supabase-auth.service';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { ConversationsService } from './conversations.service';

const JOURNEY_STATES = [
  'information',
  'planning',
  'booking_intent',
  'service_recovery',
] as const;

/** `/v1/admin/conversations` (API §3.4) — the triage list (UX §11), full
 * thread view, ABS §15 QA rubric scoring, and the Playbook §7 flag-for-review
 * loop. Same `SupabaseAuthGuard`+`HotelScopeGuard` pair as every other
 * hotel-scoped admin route. */
@Controller('v1/admin/conversations')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  async list(
    @CurrentHotelId() hotelId: string,
    @Query('escalated') escalated?: string,
    @Query('hasLead') hasLead?: string,
    @Query('journeyState') journeyState?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (journeyState && !JOURNEY_STATES.includes(journeyState as never)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_JOURNEY_STATE',
          message: `"journeyState" must be one of: ${JOURNEY_STATES.join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return this.conversations.list(hotelId, {
      escalated: this.parseBoolean('escalated', escalated),
      hasLead: this.parseBoolean('hasLead', hasLead),
      journeyState,
      from: this.parseDate('from', from),
      to: this.parseDate('to', to),
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  async get(@CurrentHotelId() hotelId: string, @Param('id') id: string) {
    return this.conversations.get(hotelId, id);
  }

  @Post(':id/qa-score')
  async submitQaScore(
    @CurrentHotelId() hotelId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentSupabaseUser() user: SupabaseUser,
  ) {
    return this.conversations.submitQaScore(hotelId, id, body, user.email);
  }

  @Patch(':id/qa-score')
  async reviseQaScore(
    @CurrentHotelId() hotelId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.conversations.reviseQaScore(hotelId, id, body);
  }

  @Post(':id/flag-for-playbook')
  async flagForPlaybook(
    @CurrentHotelId() hotelId: string,
    @Param('id') id: string,
    @Body() body: FlagForPlaybookRequest,
  ) {
    return this.conversations.flagForPlaybook(hotelId, id, body ?? {});
  }

  private parseBoolean(name: string, value?: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new BadRequestException({
      error: {
        code: 'INVALID_FIELD',
        message: `"${name}" must be "true" or "false".`,
        requestId: randomUUID(),
      },
    });
  }

  private parseDate(name: string, value?: string): Date | undefined {
    if (!value) return undefined;
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
}
