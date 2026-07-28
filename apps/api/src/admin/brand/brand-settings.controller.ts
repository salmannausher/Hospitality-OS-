import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { UpdateBrandSettingsRequest } from '@hospitality/types';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { BrandSettingsService } from './brand-settings.service';

/** `/v1/admin/brand` (API §3.5) — `BrandSettings` read/write, with WCAG AA
 * contrast validated at save time (findings-log.md #17). Only HOTEL_ADMIN+
 * should be able to touch this per API §1's role table, but role-gating
 * itself is Sprint 4 ticket 8's job across every admin route, not built
 * per-route here. */
@Controller('v1/admin/brand')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminBrandController {
  constructor(private readonly brandSettings: BrandSettingsService) {}

  @Get()
  async get(@CurrentHotelId() hotelId: string) {
    return this.brandSettings.get(hotelId);
  }

  @Patch()
  async update(
    @CurrentHotelId() hotelId: string,
    @Body() body: UpdateBrandSettingsRequest,
  ) {
    return this.brandSettings.update(hotelId, body ?? {});
  }
}
