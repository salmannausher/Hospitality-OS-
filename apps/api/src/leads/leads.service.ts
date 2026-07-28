import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { LeadStatus as PrismaLeadStatus } from '@prisma/client';
import type {
  CreateManualLeadRequest,
  LeadSummary,
  Paginated,
  UpdateLeadRequest,
} from '@hospitality/types';
import { bumpDailyMetric } from '../analytics/daily-metrics';
import { notifyHotelMembers } from '../notifications/notify';
import { PrismaService } from '../common/prisma/prisma.service';

const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
] as const;

export interface ListLeadsOptions {
  status?: string;
  cursor?: string;
  limit?: number;
}

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

      // Dashboard `leadCount` rollup (findings-log.md #12) + a NEW_LEAD
      // notification (findings-log.md #21) — only a genuinely new, consented
      // lead counts (never a decline, never a repeat field submission
      // against the same row that's already been counted once).
      if (!existing && !declined && lead.consentGiven) {
        await bumpDailyMetric(tx, hotelId, { leadCount: 1 });
        await notifyHotelMembers(tx, hotelId, 'NEW_LEAD', {
          leadId: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
        });
      }

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

  /** `GET /v1/admin/leads` (API §3.4) — the inbox list, filterable by
   * `status`, cursor-paginated same as every other admin list. Role-gating
   * ("MARKETING can't reassign leads," API §1) is deliberately not enforced
   * here — that's Sprint 4 ticket 8's job (`/session`, hotel CRUD, role
   * gating verified per role), not this ticket's. */
  async list(
    hotelId: string,
    opts: ListLeadsOptions,
  ): Promise<Paginated<LeadSummary>> {
    const limit = Math.min(opts.limit ?? 50, 100);
    const status = opts.status ? this.requireStatus(opts.status) : undefined;
    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.lead.findMany({
        where: { deletedAt: null, ...(status ? { status } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
        this.toSummary(r),
      );
      return { items, nextCursor: hasMore ? rows[limit - 1].id : null };
    });
  }

  /** `GET /v1/admin/leads/:id` (API §3.4). */
  async get(hotelId: string, id: string): Promise<LeadSummary> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id, deletedAt: null } });
      if (!lead) throw this.notFound(id);
      return this.toSummary(lead);
    });
  }

  /** `PATCH /v1/admin/leads/:id` (API §3.4) — status/owner/notes updates
   * only; contact/trip details come from the guest (chat) or manual entry,
   * never an admin edit. */
  async update(
    hotelId: string,
    id: string,
    body: UpdateLeadRequest,
  ): Promise<LeadSummary> {
    const data: {
      status?: PrismaLeadStatus;
      assignedOwnerId?: string | null;
      notes?: string | null;
    } = {};
    if (body.status !== undefined)
      data.status = this.requireStatus(body.status);
    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message: '"notes" must be a string or null.',
            requestId: randomUUID(),
          },
        });
      }
      data.notes = body.notes;
    }

    return this.prisma.withTenant(hotelId, async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw this.notFound(id);

      if (body.assignedOwnerId !== undefined) {
        if (body.assignedOwnerId !== null) {
          const membership = await tx.hotelMembership.findFirst({
            where: { userId: body.assignedOwnerId, hotelId },
          });
          if (!membership) {
            throw new BadRequestException({
              error: {
                code: 'INVALID_OWNER',
                message: `"${body.assignedOwnerId}" has no membership for this hotel.`,
                requestId: randomUUID(),
              },
            });
          }
        }
        data.assignedOwnerId = body.assignedOwnerId;
      }

      const updated = await tx.lead.update({ where: { id }, data });
      return this.toSummary(updated);
    });
  }

  /** `POST /v1/admin/leads` (API §3.4) — manual entry for a phone or walk-in
   * inquiry. `conversationId` stays `null` — that's what distinguishes it
   * from a chat-captured lead (findings-log.md #15: no stored `source`
   * column, derived instead). `consentGiven: true` — a staff member directly
   * captured this from a real interaction with the guest, the same
   * affirmative-step reasoning `EscalationsService.captureContact` uses. */
  async createManual(
    hotelId: string,
    body: CreateManualLeadRequest,
  ): Promise<LeadSummary> {
    if (!body.name && !body.email && !body.phone) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_CONTACT_INFO',
          message: 'At least one of "name", "email", or "phone" is required.',
          requestId: randomUUID(),
        },
      });
    }
    return this.prisma.withTenant(hotelId, async (tx) => {
      const lead = await tx.lead.create({
        data: {
          hotelId,
          conversationId: null,
          consentGiven: true,
          name: body.name,
          email: body.email,
          phone: body.phone,
          travelDates: body.travelDates,
          budget: body.budget,
          guestCount: body.guestCount,
          reasonForStay: body.reasonForStay,
          preferredRoom: body.preferredRoom,
          notes: body.notes,
        },
      });
      // Dashboard `leadCount` rollup (findings-log.md #12) — a manual entry
      // is a real lead the same as a chat-captured one.
      await bumpDailyMetric(tx, hotelId, { leadCount: 1 });
      await notifyHotelMembers(tx, hotelId, 'NEW_LEAD', {
        leadId: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
      });
      return this.toSummary(lead);
    });
  }

  private requireStatus(value: string): (typeof LEAD_STATUSES)[number] {
    if (!LEAD_STATUSES.includes(value as never)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_STATUS',
          message: `"status" must be one of: ${LEAD_STATUSES.join(', ')}.`,
          requestId: randomUUID(),
        },
      });
    }
    return value as (typeof LEAD_STATUSES)[number];
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'LEAD_NOT_FOUND',
        message: `No lead with id "${id}".`,
        requestId: randomUUID(),
      },
    });
  }

  private toSummary(lead: {
    id: string;
    status: string;
    conversationId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    travelDates: string | null;
    budget: string | null;
    guestCount: number | null;
    reasonForStay: string | null;
    preferredRoom: string | null;
    consentGiven: boolean;
    leadScore: number | null;
    assignedOwnerId: string | null;
    notes: string | null;
    createdAt: Date;
  }): LeadSummary {
    return {
      id: lead.id,
      status: lead.status as LeadSummary['status'],
      source: lead.conversationId === null ? 'manual' : 'chat',
      conversationId: lead.conversationId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      travelDates: lead.travelDates,
      budget: lead.budget,
      guestCount: lead.guestCount,
      reasonForStay: lead.reasonForStay,
      preferredRoom: lead.preferredRoom,
      consentGiven: lead.consentGiven,
      leadScore: lead.leadScore,
      assignedOwnerId: lead.assignedOwnerId,
      notes: lead.notes,
      createdAt: lead.createdAt.toISOString(),
    };
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
