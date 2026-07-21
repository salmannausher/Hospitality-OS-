import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import {
  IngestionService,
  type DocumentStatusValue,
} from '../../knowledge/ingestion.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { HotelScopeGuard } from '../hotel-scope.guard';
import { CurrentHotelId } from '../current-hotel-id.decorator';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — a rate sheet PDF, not a data dump.
const VALID_STATUSES: readonly DocumentStatusValue[] = [
  'PARSING',
  'NEEDS_REVIEW',
  'FAILED',
  'INDEXED',
];

/**
 * Admin knowledge upload surface (API §3.2) — a thin wrapper over the already
 * built and verified `IngestionService`. `SupabaseAuthGuard` verifies the JWT;
 * `HotelScopeGuard` resolves and authorizes which hotel the call operates on
 * (both shared with every other admin route, not re-implemented here).
 *
 * The guided "Needs Review" PATCH form (UX §9) is deliberately not built yet
 * — see docs/14-sprint-backlog.md: entity tables have no `documentId` link
 * back to the document they were extracted from, so there's no way to target
 * a specific entity's missing field from here without a schema migration
 * across all nine entity tables. `validationIssues` (read-only) surfaces
 * *what's* wrong in the meantime; editing it is a follow-up decision.
 */
@Controller('v1/admin/knowledge')
@UseGuards(SupabaseAuthGuard, HotelScopeGuard)
export class AdminKnowledgeController {
  constructor(private readonly ingestion: IngestionService) {}

  /** Multipart upload OR `{ "sourceUrl": "..." }` for URL sync (API §3.2). */
  @Post('documents')
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async create(
    @CurrentHotelId() hotelId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { sourceUrl?: string },
  ) {
    if (file) {
      const { documentId } = await this.ingestion.ingestFile(
        hotelId,
        file.originalname,
        file.buffer,
      );
      // No separate Job aggregate exists — IngestionJob rows are keyed by
      // documentId (per-stage), so documentId doubles as the job correlation
      // id the spec's `{ documentId, jobId }` shape expects.
      return { documentId, jobId: documentId };
    }
    if (body?.sourceUrl) {
      const { documentId } = await this.ingestion.ingestUrl(
        hotelId,
        body.sourceUrl,
      );
      return { documentId, jobId: documentId };
    }
    throw new BadRequestException({
      error: {
        code: 'MISSING_SOURCE',
        message: 'Provide a file (multipart "file" field) or a sourceUrl.',
        requestId: randomUUID(),
      },
    });
  }

  /** List with status filter — powers the upload screen's badges (UX §9). */
  @Get('documents')
  async list(
    @CurrentHotelId() hotelId: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (status && !VALID_STATUSES.includes(status as DocumentStatusValue)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATUS',
          message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
          requestId: randomUUID(),
        },
      });
    }
    return this.ingestion.listDocuments(hotelId, {
      status: status as DocumentStatusValue | undefined,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Per-stage pipeline status — polled at 2s during active processing. */
  @Get('documents/:id/status')
  async status(@CurrentHotelId() hotelId: string, @Param('id') id: string) {
    return this.ingestion.getStageStatus(hotelId, id);
  }

  /** Chunk preview — content + tags + priority, never embeddings. */
  @Get('documents/:id/chunks')
  async chunks(
    @CurrentHotelId() hotelId: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ingestion.getChunks(hotelId, id, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
