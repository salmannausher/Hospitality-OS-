import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export type EscalationChoice = 'connect_now' | 'contact_me';

export interface ChooseEscalationParams {
  escalationId?: unknown;
  choice?: unknown;
  contact?: unknown;
}

/** UX §5's confirmation copy — shown once the guest picks a handoff path. */
const CONFIRMATION_MESSAGE =
  'Our team has your conversation and will follow up shortly.';

/**
 * Backs `POST /v1/chat/escalation/choose` (API §2.3) and the `Escalation`
 * row an `escalation` SSE event creates (ABS §7 point 4: "log the escalation
 * reason as a structured tag"). The full transcript never needs a separate
 * copy here — `Escalation.conversationId` already gives the receiving team
 * transcript access via the existing `Conversation`/`Message` tables (ABS §7
 * point 3's "package the transcript" is satisfied by the FK, not a second
 * store of the same data).
 */
@Injectable()
export class EscalationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the `Escalation` row an `escalation` SSE event references — called
   * from `ChatService` the moment a trigger fires (ABS §7), never client-side. */
  async create(
    hotelId: string,
    conversationId: string,
    reason: string,
  ): Promise<string> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const escalation = await tx.escalation.create({
        data: { hotelId, conversationId, reason },
      });
      return escalation.id;
    });
  }

  /** `POST /v1/chat/escalation/choose` (API §2.3). `contact_me` folds contact
   * capture into the handoff itself (ABS §8: "capture is folded into the
   * handoff, not a separate ask") via the same find-or-create-by-conversation
   * pattern `LeadsService.submitAnswer` uses. `connect_now` is rejected, not
   * silently no-op'd — there is no live-staff channel in V1 (`liveStaffAvailable`
   * is always `false`, Architecture/API §5), and claiming to connect a guest to
   * one that doesn't exist is exactly the over-promising ABS §19 forbids. */
  async choose(
    hotelId: string,
    params: ChooseEscalationParams,
  ): Promise<{ message: string }> {
    const escalationId = this.requireString(
      params.escalationId,
      'escalationId',
    );
    const choice = this.requireChoice(params.choice);

    return this.prisma.withTenant(hotelId, async (tx) => {
      const escalation = await tx.escalation.findFirst({
        where: { id: escalationId },
      });
      if (!escalation) {
        throw new NotFoundException({
          error: {
            code: 'ESCALATION_NOT_FOUND',
            message: `No escalation with id "${escalationId}".`,
            requestId: randomUUID(),
          },
        });
      }

      if (choice === 'connect_now') {
        throw new BadRequestException({
          error: {
            code: 'LIVE_STAFF_UNAVAILABLE',
            message:
              'Live handoff is not available yet — please choose contact_me instead.',
            requestId: randomUUID(),
          },
        });
      }

      await this.captureContact(
        tx,
        hotelId,
        escalation.conversationId,
        params.contact,
      );
      return { message: CONFIRMATION_MESSAGE };
    });
  }

  private async captureContact(
    tx: Prisma.TransactionClient,
    hotelId: string,
    conversationId: string,
    rawContact: unknown,
  ): Promise<void> {
    if (rawContact == null || typeof rawContact !== 'object') return;
    const contact = rawContact as Record<string, unknown>;
    const data: { name?: string; email?: string; phone?: string } = {};
    if (typeof contact.name === 'string') data.name = contact.name;
    if (typeof contact.email === 'string') data.email = contact.email;
    if (typeof contact.phone === 'string') data.phone = contact.phone;
    if (Object.keys(data).length === 0) return;

    // consentGiven: true — the guest just took an explicit affirmative step
    // (chose "email me / call me back" and typed contact info in response to
    // a stated purpose, ABS §8), distinct from ambient collection.
    const existing = await tx.lead.findFirst({
      where: { hotelId, conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await tx.lead.update({
        where: { id: existing.id },
        data: { ...data, consentGiven: true },
      });
    } else {
      await tx.lead.create({
        data: { hotelId, conversationId, ...data, consentGiven: true },
      });
    }
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException({
        error: {
          code: 'MISSING_FIELD',
          message: `"${field}" is required and must be a non-empty string.`,
          requestId: randomUUID(),
        },
      });
    }
    return value;
  }

  private requireChoice(value: unknown): EscalationChoice {
    if (value !== 'connect_now' && value !== 'contact_me') {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FIELD',
          message: '"choice" must be one of: connect_now, contact_me.',
          requestId: randomUUID(),
        },
      });
    }
    return value;
  }
}
