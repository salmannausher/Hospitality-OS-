import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { CurrentHotelId } from '../current-hotel-id.decorator';
import { RelationshipsService } from './relationships.service';

/** `EntityRelationship` CRUD + bundle preview (API §3.3). `preview` is
 * registered before `:id` so it isn't swallowed by that param. */
@Controller('v1/admin/relationships')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminRelationshipsController {
  constructor(private readonly relationships: RelationshipsService) {}

  /** `{ "contextTag": "anniversary" }` → the exact `card` SSE payload a guest
   * would receive — the Relationship Bundle builder's live preview (UX §10). */
  @Post('preview')
  async preview(
    @CurrentHotelId() hotelId: string,
    @Body() body: { contextTag?: unknown },
  ) {
    if (
      typeof body?.contextTag !== 'string' ||
      body.contextTag.trim().length === 0
    ) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_FIELD',
          message: '"contextTag" is required and must be a non-empty string.',
          requestId: randomUUID(),
        },
      });
    }
    return this.relationships.preview(hotelId, body.contextTag);
  }

  @Get()
  async list(
    @CurrentHotelId() hotelId: string,
    @Query('contextTag') contextTag?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.relationships.list(hotelId, {
      contextTag,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  async get(@CurrentHotelId() hotelId: string, @Param('id') id: string) {
    return this.relationships.get(hotelId, id);
  }

  @Post()
  async create(
    @CurrentHotelId() hotelId: string,
    @Body()
    body: {
      fromEntityType?: unknown;
      fromEntityId?: unknown;
      toEntityType?: unknown;
      toEntityId?: unknown;
      relationshipType?: unknown;
      contextTag?: unknown;
      priority?: unknown;
    },
  ) {
    return this.relationships.create(hotelId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentHotelId() hotelId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.relationships.remove(hotelId, id);
  }
}
