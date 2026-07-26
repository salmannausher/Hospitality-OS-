import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  ConversationDetail,
  ConversationSummary,
  FlagForPlaybookRequest,
  FlagForPlaybookResponse,
  JourneyState,
  MessageDetail,
  Paginated,
  QAScoreDetail,
  QAScoreInput,
} from '@hospitality/types';
import { PrismaService } from '../../common/prisma/prisma.service';

const QA_FIELDS = [
  'grounding',
  'tone',
  'escalation',
  'leadCapture',
  'resolution',
] as const;

export interface ListConversationsOptions {
  escalated?: boolean;
  hasLead?: boolean;
  journeyState?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
}

/**
 * Backs `GET /v1/admin/conversations[/:id]`, `POST`/`PATCH .../qa-score`
 * (ABS §15 rubric), and `POST .../flag-for-playbook` (API §3.4, closes the
 * Playbook §7 loop). `Conversation` has no `domainTags`/`journeyState` field
 * of its own (UX §11's "topic tags" and journey state are per-message, DB
 * §10) — both are derived here from the conversation's messages, not stored
 * redundantly.
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    hotelId: string,
    opts: ListConversationsOptions,
  ): Promise<Paginated<ConversationSummary>> {
    const limit = Math.min(opts.limit ?? 50, 100);
    const where: Prisma.ConversationWhereInput = {
      ...(opts.from || opts.to
        ? {
            startedAt: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
      ...(opts.escalated === true ? { escalations: { some: {} } } : {}),
      ...(opts.escalated === false ? { escalations: { none: {} } } : {}),
      ...(opts.hasLead === true
        ? { leads: { some: { deletedAt: null } } }
        : {}),
      ...(opts.hasLead === false
        ? { leads: { none: { deletedAt: null } } }
        : {}),
      ...(opts.journeyState
        ? { messages: { some: { journeyState: opts.journeyState as never } } }
        : {}),
    };

    return this.prisma.withTenant(hotelId, async (tx) => {
      const rows = await tx.conversation.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
        include: {
          messages: { select: { domainTags: true, journeyState: true } },
          escalations: { select: { id: true }, take: 1 },
          leads: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { leadScore: true },
          },
        },
      });
      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map((row) =>
        this.toSummary(row),
      );
      return {
        items,
        nextCursor: hasMore ? rows[limit - 1].id : null,
      };
    });
  }

  async get(hotelId: string, id: string): Promise<ConversationDetail> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const row = await tx.conversation.findFirst({
        where: { id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          escalations: { select: { id: true }, take: 1 },
          leads: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { leadScore: true },
          },
          qaScore: true,
        },
      });
      if (!row) throw this.notFound(id);
      return {
        ...this.toSummary(row),
        messages: row.messages.map((m): MessageDetail => ({
          id: m.id,
          role: m.role,
          content: m.content,
          journeyState: m.journeyState,
          confidenceBand: m.confidenceBand,
          escalationTriggered: m.escalationTriggered,
          leadCaptureTriggered: m.leadCaptureTriggered,
          domainTags: m.domainTags,
          createdAt: m.createdAt.toISOString(),
        })),
        qaScore: row.qaScore ? this.toQaScoreDetail(row.qaScore) : null,
      };
    });
  }

  async submitQaScore(
    hotelId: string,
    conversationId: string,
    body: unknown,
    scoredBy: string,
  ): Promise<QAScoreDetail> {
    const input = this.validateQaScoreInput(body);
    return this.prisma.withTenant(hotelId, async (tx) => {
      await this.requireConversation(tx, conversationId);
      try {
        const created = await tx.qAScore.create({
          data: { hotelId, conversationId, ...input, scoredBy },
        });
        return this.toQaScoreDetail(created);
      } catch (err) {
        if ((err as { code?: string }).code === 'P2002') {
          throw new ConflictException({
            error: {
              code: 'QA_SCORE_ALREADY_EXISTS',
              message: `Conversation "${conversationId}" already has a QA score — use PATCH to revise it.`,
              requestId: randomUUID(),
            },
          });
        }
        throw err;
      }
    });
  }

  async reviseQaScore(
    hotelId: string,
    conversationId: string,
    body: unknown,
  ): Promise<QAScoreDetail> {
    const input = this.validateQaScoreInput(body);
    return this.prisma.withTenant(hotelId, async (tx) => {
      const existing = await tx.qAScore.findUnique({
        where: { conversationId },
      });
      if (!existing) {
        throw new NotFoundException({
          error: {
            code: 'QA_SCORE_NOT_FOUND',
            message: `Conversation "${conversationId}" has no QA score yet — use POST to create one.`,
            requestId: randomUUID(),
          },
        });
      }
      const updated = await tx.qAScore.update({
        where: { conversationId },
        data: input,
      });
      return this.toQaScoreDetail(updated);
    });
  }

  /** `POST /v1/admin/conversations/:id/flag-for-playbook` — creates a
   * `PlaybookScenario` from the transcript (Playbook §7's closed loop).
   * `domain`/`journeyState` are derived from the concierge reply that
   * immediately follows the chosen guest message (defaulting to the
   * conversation's first guest message) — everything an algorithm CAN
   * infer from the transcript; `expectedBehavior`/`mustNot` are exactly
   * the qualitative judgments API §3.4 says the request body pre-fills,
   * since nothing can infer those automatically. */
  async flagForPlaybook(
    hotelId: string,
    conversationId: string,
    body: FlagForPlaybookRequest,
  ): Promise<FlagForPlaybookResponse> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!conversation) throw this.notFound(conversationId);

      const guestMessage = body.messageId
        ? conversation.messages.find(
            (m) => m.id === body.messageId && m.role === 'GUEST',
          )
        : conversation.messages.find((m) => m.role === 'GUEST');
      if (!guestMessage) {
        throw new BadRequestException({
          error: {
            code: 'GUEST_MESSAGE_NOT_FOUND',
            message: body.messageId
              ? `No GUEST message with id "${body.messageId}" in this conversation.`
              : 'This conversation has no guest messages to flag.',
            requestId: randomUUID(),
          },
        });
      }

      // The concierge turn that answered this guest message — where domain/
      // journeyState/escalation/lead-capture facts actually live (Message,
      // not Conversation, DB §10).
      const reply = conversation.messages.find(
        (m) => m.role === 'CONCIERGE' && m.createdAt > guestMessage.createdAt,
      );
      const journeyState = (reply?.journeyState ??
        conversation.messages.find((m) => m.journeyState)?.journeyState) as
        JourneyState | undefined;
      if (!journeyState) {
        throw new BadRequestException({
          error: {
            code: 'JOURNEY_STATE_UNKNOWN',
            message:
              'This conversation has no concierge reply yet to infer a journeyState from — PlaybookScenario requires one.',
            requestId: randomUUID(),
          },
        });
      }

      const scenario = await tx.playbookScenario.create({
        data: {
          hotelId,
          domain: reply?.domainTags[0] ?? null,
          journeyState,
          persona: null,
          guestMessage: guestMessage.content,
          expectedBehavior: body.expectedBehavior ?? [],
          escalationExpected:
            body.escalationExpected ?? reply?.escalationTriggered ?? false,
          leadCaptureExpected:
            body.leadCaptureExpected ?? reply?.leadCaptureTriggered ?? false,
          mustNot: body.mustNot ?? [],
          source: 'PILOT_TRANSCRIPT',
          sourceConversationId: conversationId,
        },
      });
      return { scenarioId: scenario.id };
    });
  }

  private async requireConversation(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    const exists = await tx.conversation.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw this.notFound(id);
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      error: {
        code: 'CONVERSATION_NOT_FOUND',
        message: `No conversation with id "${id}".`,
        requestId: randomUUID(),
      },
    });
  }

  private validateQaScoreInput(body: unknown): QAScoreInput {
    if (typeof body !== 'object' || body === null) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_BODY',
          message: 'Request body must be an object.',
          requestId: randomUUID(),
        },
      });
    }
    const record = body as Record<string, unknown>;
    const result = {} as QAScoreInput;
    for (const field of QA_FIELDS) {
      const value = record[field];
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
      ) {
        throw new BadRequestException({
          error: {
            code: 'INVALID_FIELD',
            message: `"${field}" must be an integer from 1 to 5.`,
            requestId: randomUUID(),
          },
        });
      }
      result[field] = value;
    }
    return result;
  }

  private toQaScoreDetail(row: {
    id: string;
    grounding: number;
    tone: number;
    escalation: number;
    leadCapture: number;
    resolution: number;
    scoredBy: string;
    scoredAt: Date;
  }): QAScoreDetail {
    return {
      id: row.id,
      grounding: row.grounding,
      tone: row.tone,
      escalation: row.escalation,
      leadCapture: row.leadCapture,
      resolution: row.resolution,
      scoredBy: row.scoredBy,
      scoredAt: row.scoredAt.toISOString(),
    };
  }

  private toSummary(row: {
    id: string;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
    messages: Array<{ domainTags: string[]; journeyState: string | null }>;
    escalations: Array<{ id: string }>;
    leads: Array<{ leadScore: number | null }>;
  }): ConversationSummary {
    const domainTags = [...new Set(row.messages.flatMap((m) => m.domainTags))];
    const journeyState = [...row.messages].reverse().find((m) => m.journeyState)
      ?.journeyState as JourneyState | undefined;
    return {
      id: row.id,
      status: row.status as ConversationSummary['status'],
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      journeyState: journeyState ?? null,
      domainTags,
      escalated: row.escalations.length > 0,
      hasLead: row.leads.length > 0,
      leadScore: row.leads[0]?.leadScore ?? null,
      messageCount: row.messages.length,
    };
  }
}
