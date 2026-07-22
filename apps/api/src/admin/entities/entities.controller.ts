import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { EntitiesService } from './entities.service';

/**
 * One uniform CRUD surface for all nine structured-entity types (API §3.3) —
 * `:type` is the kebab-case route param defined in `entity-config.ts`
 * (`room-types`, `spa-treatments`, ...). `search` is registered before `:type`
 * so it isn't swallowed by that param.
 */
@Controller('v1/admin/entities')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminEntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  /** Typeahead for the Relationship Bundle builder (UX §10). */
  @Get('search')
  async search(
    @CurrentHotelId() hotelId: string,
    @Query('q') q?: string,
    @Query('types') types?: string,
  ) {
    if (!q) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_QUERY',
          message: '"q" query param is required.',
          requestId: randomUUID(),
        },
      });
    }
    return this.entities.search(hotelId, {
      q,
      types: types
        ? types
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    });
  }

  @Get(':type')
  async list(
    @CurrentHotelId() hotelId: string,
    @Param('type') type: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entities.list(hotelId, type, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':type/:id')
  async get(
    @CurrentHotelId() hotelId: string,
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.entities.get(hotelId, type, id);
  }

  @Post(':type')
  async create(
    @CurrentHotelId() hotelId: string,
    @Param('type') type: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.entities.create(hotelId, type, body);
  }

  @Patch(':type/:id')
  async update(
    @CurrentHotelId() hotelId: string,
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.entities.update(hotelId, type, id, body);
  }

  @Delete(':type/:id')
  @HttpCode(204)
  async remove(
    @CurrentHotelId() hotelId: string,
    @Param('type') type: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.entities.remove(hotelId, type, id);
  }
}
