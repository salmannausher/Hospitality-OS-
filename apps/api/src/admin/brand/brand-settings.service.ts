import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  BrandSettingsResponse,
  ContrastFailureDetail,
  UpdateBrandSettingsRequest,
} from '@hospitality/types';
import {
  contrastRatio,
  isValidHexColor,
  WCAG_AA_NORMAL_TEXT_RATIO,
} from '../../common/color-contrast';
import { PrismaService } from '../../common/prisma/prisma.service';

const TONE_PRESETS = [
  'CLASSIC_LUXURY',
  'MODERN_LUXURY',
  'BOUTIQUE',
  'FAMILY_FRIENDLY',
] as const;

/** The neutral background a brand color renders against in the guest widget
 * (UI Design System §9: "follows the hotel's light brand by default") —
 * `primaryColor`/`secondaryColor` are checked as button/badge background
 * colors with white foreground text (findings-log.md #17's documented
 * judgment call on an otherwise-unspecified contrast rule). */
const NEUTRAL_BACKGROUND = '#FFFFFF';

const COLOR_FIELDS = ['primaryColor', 'secondaryColor'] as const;

/**
 * Backs `GET/PATCH /v1/admin/brand` (API §3.5). `BrandSettings` is optional
 * on `Hotel` (DB §"Brand & Prompts") — a hotel can exist with no row yet, so
 * `get()` returns the same fallback defaults `ChatService.bootstrap` already
 * uses rather than a 404, and `update()` upserts (creating the row on first
 * save) rather than requiring a separate create step.
 */
@Injectable()
export class BrandSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(hotelId: string): Promise<BrandSettingsResponse> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const hotel = await tx.hotel.findFirstOrThrow({
        include: { brandSettings: true },
      });
      return this.toResponse(hotel.name, hotel.brandSettings);
    });
  }

  async update(
    hotelId: string,
    body: UpdateBrandSettingsRequest,
  ): Promise<BrandSettingsResponse> {
    const data = this.validate(body);

    return this.prisma.withTenant(hotelId, async (tx) => {
      const hotel = await tx.hotel.findFirstOrThrow({
        include: { brandSettings: true },
      });

      const updated = hotel.brandSettings
        ? await tx.brandSettings.update({ where: { hotelId }, data })
        : await tx.brandSettings.create({
            data: {
              hotelId,
              conciergeName:
                (data.conciergeName as string | undefined) ??
                `${hotel.name} Concierge`,
              greeting:
                (data.greeting as string | undefined) ??
                `Welcome to ${hotel.name}. How may I help you today?`,
              ...data,
            },
          });

      return this.toResponse(hotel.name, updated);
    });
  }

  /** Validates field shapes/enums, then WCAG AA contrast (API §3.5's
   * `422 CONTRAST_FAILURE`, findings-log.md #17) — only for color fields
   * actually present in this request, not the whole stored row, matching
   * "validate what's about to be saved." */
  private validate(body: UpdateBrandSettingsRequest): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (body.conciergeName !== undefined) {
      data.conciergeName = this.requireNonEmptyString(
        body.conciergeName,
        'conciergeName',
      );
    }
    if (body.greeting !== undefined) {
      data.greeting = this.requireNonEmptyString(body.greeting, 'greeting');
    }
    if (body.tonePreset !== undefined) {
      if (!TONE_PRESETS.includes(body.tonePreset)) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_TONE_PRESET',
            message: `"tonePreset" must be one of: ${TONE_PRESETS.join(', ')}.`,
            requestId: randomUUID(),
          },
        });
      }
      data.tonePreset = body.tonePreset;
    }
    if (body.emojiAllowed !== undefined) {
      if (typeof body.emojiAllowed !== 'boolean') {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message: '"emojiAllowed" must be a boolean.',
            requestId: randomUUID(),
          },
        });
      }
      data.emojiAllowed = body.emojiAllowed;
    }
    if (body.groupInquiryThreshold !== undefined) {
      if (
        !Number.isInteger(body.groupInquiryThreshold) ||
        body.groupInquiryThreshold < 1
      ) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message: '"groupInquiryThreshold" must be a positive integer.',
            requestId: randomUUID(),
          },
        });
      }
      data.groupInquiryThreshold = body.groupInquiryThreshold;
    }
    for (const field of [
      'formalityNote',
      'signOff',
      'logoUrl',
      'fontFamily',
      'bookingEngineUrl',
    ] as const) {
      const value = body[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== 'string') {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message: `"${field}" must be a string or null.`,
            requestId: randomUUID(),
          },
        });
      }
      data[field] = value;
    }

    const contrastFailures: ContrastFailureDetail[] = [];
    for (const field of COLOR_FIELDS) {
      const value = body[field];
      if (value === undefined) continue;
      if (value !== null) {
        if (!isValidHexColor(value)) {
          throw new BadRequestException({
            error: {
              code: 'INVALID_FIELD',
              message: `"${field}" must be a hex color like "#2F4A3C".`,
              requestId: randomUUID(),
            },
          });
        }
        const ratio = contrastRatio(NEUTRAL_BACKGROUND, value) ?? 0;
        if (ratio < WCAG_AA_NORMAL_TEXT_RATIO) {
          contrastFailures.push({
            field,
            color: value,
            against: NEUTRAL_BACKGROUND,
            ratio: Math.round(ratio * 100) / 100,
            required: WCAG_AA_NORMAL_TEXT_RATIO,
          });
        }
      }
      data[field] = value;
    }

    if (contrastFailures.length > 0) {
      throw new UnprocessableEntityException({
        error: {
          code: 'CONTRAST_FAILURE',
          message: `The following color(s) fail WCAG AA contrast (${WCAG_AA_NORMAL_TEXT_RATIO}:1) against ${NEUTRAL_BACKGROUND}: ${contrastFailures
            .map((f) => `${f.field} (${f.color})`)
            .join(', ')}.`,
          requestId: randomUUID(),
          details: contrastFailures,
        },
      });
    }

    return data;
  }

  private requireNonEmptyString(value: string, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_FIELD',
          message: `"${field}" must be a non-empty string.`,
          requestId: randomUUID(),
        },
      });
    }
    return value;
  }

  private toResponse(
    hotelName: string,
    brand: {
      conciergeName: string;
      tonePreset: string;
      formalityNote: string | null;
      emojiAllowed: boolean;
      signOff: string | null;
      greeting: string;
      logoUrl: string | null;
      primaryColor: string | null;
      secondaryColor: string | null;
      fontFamily: string | null;
      bookingEngineUrl: string | null;
      groupInquiryThreshold: number;
      updatedAt: Date;
    } | null,
  ): BrandSettingsResponse {
    if (!brand) {
      // Same fallback defaults ChatService.bootstrap already uses when no
      // row exists yet — never a silent/undefined field in the response.
      return {
        conciergeName: `${hotelName} Concierge`,
        tonePreset: 'MODERN_LUXURY',
        formalityNote: null,
        emojiAllowed: false,
        signOff: null,
        greeting: `Welcome to ${hotelName}. How may I help you today?`,
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        fontFamily: null,
        bookingEngineUrl: null,
        groupInquiryThreshold: 15,
        updatedAt: null,
      };
    }
    return {
      conciergeName: brand.conciergeName,
      tonePreset: brand.tonePreset as BrandSettingsResponse['tonePreset'],
      formalityNote: brand.formalityNote,
      emojiAllowed: brand.emojiAllowed,
      signOff: brand.signOff,
      greeting: brand.greeting,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      fontFamily: brand.fontFamily,
      bookingEngineUrl: brand.bookingEngineUrl,
      groupInquiryThreshold: brand.groupInquiryThreshold,
      updatedAt: brand.updatedAt.toISOString(),
    };
  }
}
