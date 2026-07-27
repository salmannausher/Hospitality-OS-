import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateManualLeadRequest,
  UpdateLeadRequest,
} from '@hospitality/types';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { LeadsService } from '../../leads/leads.service';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { HotelScopeGuard } from '../hotel-scope.guard';

/** `/v1/admin/leads` (API §3.4) — the inbox list/detail/update, plus manual
 * entry for a phone or walk-in inquiry. Same `LeadsService` the guest-facing
 * `POST /v1/chat/lead` flow uses (`leads.module.ts`'s own doc comment), not a
 * second implementation. Role-gating ("MARKETING can't reassign leads," API
 * §1) is deliberately not enforced here — Sprint 4 ticket 8's job. */
@Controller('v1/admin/leads')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminLeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  async list(
    @CurrentHotelId() hotelId: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leads.list(hotelId, {
      status,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  async get(@CurrentHotelId() hotelId: string, @Param('id') id: string) {
    return this.leads.get(hotelId, id);
  }

  @Patch(':id')
  async update(
    @CurrentHotelId() hotelId: string,
    @Param('id') id: string,
    @Body() body: UpdateLeadRequest,
  ) {
    return this.leads.update(hotelId, id, body ?? {});
  }

  @Post()
  async createManual(
    @CurrentHotelId() hotelId: string,
    @Body() body: CreateManualLeadRequest,
  ) {
    return this.leads.createManual(hotelId, body ?? {});
  }
}
