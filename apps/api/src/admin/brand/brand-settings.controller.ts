import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { UpdateBrandSettingsRequest } from '@hospitality/types';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { RequireRole } from '../require-role.decorator';
import { BrandSettingsService } from './brand-settings.service';

/** `/v1/admin/brand` (API §3.5) — `BrandSettings` read/write, with WCAG AA
 * contrast validated at save time (findings-log.md #17). `HotelScopeGuard`
 * blocks a `VIEWER` from the `PATCH` automatically (findings-log.md #24);
 * `@RequireRole` additionally restricts it to `HOTEL_ADMIN+` per API §1
 * ("only HOTEL_ADMIN+ touch brand/prompt/knowledge" — findings-log.md #38). */
@Controller('v1/admin/brand')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminBrandController {
  constructor(private readonly brandSettings: BrandSettingsService) {}

  @Get()
  async get(@CurrentHotelId() hotelId: string) {
    return this.brandSettings.get(hotelId);
  }

  @Patch()
  @RequireRole('HOTEL_ADMIN', 'AGENCY_ADMIN', 'SUPER_ADMIN')
  async update(
    @CurrentHotelId() hotelId: string,
    @Body() body: UpdateBrandSettingsRequest,
  ) {
    return this.brandSettings.update(hotelId, body ?? {});
  }
}
