import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentSupabaseUser } from '../../auth/current-supabase-user.decorator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import type { SupabaseUser } from '../../auth/supabase-auth.service';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { NotificationsService } from './notifications.service';

/** `/v1/admin/notifications` (API §3.7). Same `SupabaseAuthGuard`+
 * `HotelScopeGuard` pair as every other hotel-scoped admin route, plus the
 * calling admin's own id (`@CurrentSupabaseUser()`) — notifications are
 * per-user, not just per-hotel (findings-log.md #21). */
@Controller('v1/admin/notifications')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentHotelId() hotelId: string,
    @CurrentSupabaseUser() user: SupabaseUser,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(hotelId, user.id, {
      status,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id/read')
  async markRead(
    @CurrentHotelId() hotelId: string,
    @CurrentSupabaseUser() user: SupabaseUser,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(hotelId, user.id, id);
  }
}
