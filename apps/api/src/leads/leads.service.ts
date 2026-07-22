import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';

export type LeadField = 'email' | 'dates' | 'name' | 'phone';

/** The chat-triggered flow's own field order (UX §4's worked example: dates,
 * then email) — distinct from PRD FR-007's full field menu, which lists every
 * field the platform *can* capture across scenarios (manual entry, other
 * flows), not a sequence any one ask works through. */
const CHAT_FIELD_ORDER: readonly LeadField[] = ['dates', 'email'];

const FIELD_TO_COLUMN: Record<
  LeadField,
  'travelDates' | 'email' | 'name' | 'phone'
> = {
  dates: 'travelDates',
  email: 'email',
  name: 'name',
  phone: 'phone',
};

export interface SubmitLeadAnswerParams {
  conversationId: string;
  promptId: string;
  field: unknown;
  value: unknown;
  consent: unknown;
  declined?: unknown;
}

export interface SubmitLeadAnswerResult {
  leadId: string;
  captured: LeadField[];
  nextField: LeadField | null;
}

/**
 * `POST /v1/chat/lead` (API §2.2) — submits the guest's answer to a
 * `lead_prompt`, one field at a time (UX §4). Idempotent in effect via a
 * find-or-create scoped to `conversationId`: a repeated submission (the
 * `Idempotency-Key: <promptId>` case — a double-tap resending the same
 * request) re-applies the same field value to the same row rather than
 * creating a second one. Deliberately NOT a DB-level unique constraint on
 * `conversationId` — `Conversation.leads` is a real one-to-many relation
 * (a conversation can legitimately have more than one lead-capture moment
 * over its life); this only treats "the most recent lead for this
 * conversation" as the one an in-progress chat ask continues writing to.
 */
@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitAnswer(
    hotelId: string,
    params: SubmitLeadAnswerParams,
  ): Promise<SubmitLeadAnswerResult> {
    const field = this.requireField(params.field);
    const value = this.requireNullableString(params.value, 'value');
    const consent = this.requireBoolean(params.consent, 'consent');
    const declined = params.declined === true;

    if (!params.conversationId) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_FIELD',
          message: '"conversationId" is required.',
          requestId: randomUUID(),
        },
      });
    }

    return this.prisma.withTenant(hotelId, async (tx) => {
      const existing = await tx.lead.findFirst({
        where: {
          hotelId,
          conversationId: params.conversationId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const column = value !== null ? FIELD_TO_COLUMN[field] : null;
      const lead = existing
        ? await tx.lead.update({
            where: { id: existing.id },
            data: {
              consentGiven: existing.consentGiven || consent,
              ...(column ? { [column]: value } : {}),
            },
          })
        : await tx.lead.create({
            data: {
              hotelId,
              conversationId: params.conversationId,
              consentGiven: consent,
              ...(column ? { [column]: value } : {}),
            },
          });

      // ABS §8: a decline is recorded (so the conversation never asks again)
      // but captures nothing and offers no next field.
      if (declined || !lead.consentGiven) {
        return { leadId: lead.id, captured: [], nextField: null };
      }

      const captured = CHAT_FIELD_ORDER.filter(
        (f) => lead[FIELD_TO_COLUMN[f]] != null,
      );
      const nextField =
        CHAT_FIELD_ORDER.find((f) => !captured.includes(f)) ?? null;
      return { leadId: lead.id, captured, nextField };
    });
  }

  private requireField(value: unknown): LeadField {
    if (typeof value !== 'string' || !(value in FIELD_TO_COLUMN)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message: `"field" must be one of: ${Object.keys(FIELD_TO_COLUMN).join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return value as LeadField;
  }

  private requireNullableString(value: unknown, name: string): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message: `"${name}" must be a string or null.`,
          requestId: randomUUID(),
        },
      });
    }
    return value;
  }

  private requireBoolean(value: unknown, name: string): boolean {
    if (typeof value !== 'boolean') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message: `"${name}" must be a boolean.`,
          requestId: randomUUID(),
        },
      });
    }
    return value;
  }
}
