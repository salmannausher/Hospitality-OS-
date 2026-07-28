import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateHotelRequest,
  UpdateHotelRequest,
} from '@hospitality/types';
import { CurrentSupabaseUser } from '../../auth/current-supabase-user.decorator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import type { SupabaseUser } from '../../auth/supabase-auth.service';
import { HotelsService } from './hotels.service';

/**
 * `/v1/admin/hotels` (API §3.1). Deliberately NOT `HotelScopeGuard` — that
 * guard expects a `?hotelId=` query param scoping a request to ONE hotel,
 * but this resource's own path param IS the hotel, and `GET /hotels` (the
 * list) has no single hotel to scope to at all. Authorization instead calls
 * `authorizeHotelAccess` directly inside `HotelsService` (findings-log.md
 * #22/#24) — just `SupabaseAuthGuard` here, to attach the caller's identity.
 */
@Controller('v1/admin/hotels')
@UseGuards(SupabaseAuthGuard)
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Get()
  async list(@CurrentSupabaseUser() user: SupabaseUser) {
    return this.hotels.list(user.id);
  }

  @Get(':id')
  async get(
    @CurrentSupabaseUser() user: SupabaseUser,
    @Param('id') id: string,
  ) {
    return this.hotels.get(user.id, id);
  }

  @Patch(':id')
  async update(
    @CurrentSupabaseUser() user: SupabaseUser,
    @Param('id') id: string,
    @Body() body: UpdateHotelRequest,
  ) {
    return this.hotels.update(user.id, id, body ?? {});
  }

  @Post()
  async create(
    @CurrentSupabaseUser() user: SupabaseUser,
    @Body() body: CreateHotelRequest,
  ) {
    return this.hotels.create(user.id, body ?? {});
  }
}
