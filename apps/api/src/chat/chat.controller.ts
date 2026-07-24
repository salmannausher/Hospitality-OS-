import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Headers,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ChatSSEEvent } from '@hospitality/types';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChatService } from '../ai/chat.service';
import { EscalationsService } from '../escalations/escalations.service';
import { LeadsService } from '../leads/leads.service';

/**
 * Guest Chat API (API §2) — public, scoped by widget key, never trusting a
 * client-supplied hotel id. Tenant resolution (widgetKey → hotelId) is the one
 * lookup that precedes tenant context, via PrismaService.resolveWidgetKey
 * (Architecture §4 step 1).
 */
@Controller('v1/chat')
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly leads: LeadsService,
    private readonly escalationsService: EscalationsService,
  ) {}

  // API §2.4 — GET /v1/chat/bootstrap
  @Get('bootstrap')
  async bootstrap(
    @Headers('x-widget-key') widgetKey: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const hotelId = await this.resolveHotel(widgetKey);
    const payload = await this.chat.bootstrap(hotelId);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(payload);
  }

  // API §2.1 — POST /v1/chat/message (text/event-stream)
  @Post('message')
  async message(
    @Headers('x-widget-key') widgetKey: string | undefined,
    @Body()
    body: {
      sessionId?: string;
      conversationId?: string | null;
      message?: string;
      contextTag?: string | null;
    },
    @Res() res: Response,
  ): Promise<void> {
    const hotelId = await this.resolveHotel(widgetKey);
    if (!body?.sessionId || !body?.message?.trim()) {
      throw new BadRequestException('sessionId and message are required.');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: ChatSSEEvent) =>
      res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      for await (const event of this.chat.streamTurn({
        hotelId,
        sessionId: body.sessionId,
        conversationId: body.conversationId ?? null,
        message: body.message,
        contextTag: body.contextTag ?? null,
      })) {
        send(event);
      }
    } catch (err) {
      send({
        type: 'error',
        error: {
          code: 'INTERNAL',
          message: 'The concierge is momentarily unavailable.',
          requestId: 'req_unknown',
        },
      });
      // Surface server-side for diagnosis; the guest already saw the graceful event.
      console.error('chat stream failed:', err);
    } finally {
      res.end();
    }
  }

  // API §2.2 — POST /v1/chat/lead. `Idempotency-Key` is accepted per the spec
  // (mirrors body.promptId) but not re-derived from — LeadsService's
  // find-or-create-by-conversation is what actually makes a resubmission
  // idempotent in effect; see its doc comment.
  @Post('lead')
  @HttpCode(201)
  async lead(
    @Headers('x-widget-key') widgetKey: string | undefined,
    @Body()
    body: {
      conversationId?: string;
      promptId?: string;
      field?: unknown;
      value?: unknown;
      consent?: unknown;
      declined?: unknown;
    },
  ) {
    const hotelId = await this.resolveHotel(widgetKey);
    if (!body?.conversationId || !body?.promptId) {
      throw new BadRequestException(
        'conversationId and promptId are required.',
      );
    }
    return this.leads.submitAnswer(hotelId, {
      conversationId: body.conversationId,
      promptId: body.promptId,
      field: body.field,
      value: body.value,
      consent: body.consent,
      declined: body.declined,
    });
  }

  // API §2.3 — POST /v1/chat/escalation/choose. Submits the guest's answer to
  // an `escalation` event's handoff panel (UX §5).
  @Post('escalation/choose')
  @HttpCode(202)
  async chooseEscalation(
    @Headers('x-widget-key') widgetKey: string | undefined,
    @Body()
    body: {
      escalationId?: unknown;
      choice?: unknown;
      contact?: unknown;
    },
  ) {
    const hotelId = await this.resolveHotel(widgetKey);
    return this.escalationsService.choose(hotelId, {
      escalationId: body?.escalationId,
      choice: body?.choice,
      contact: body?.contact,
    });
  }

  private async resolveHotel(widgetKey: string | undefined): Promise<string> {
    if (!widgetKey) throw new UnauthorizedException('Missing X-Widget-Key.');
    const hotelId = await this.prisma.resolveWidgetKey(widgetKey);
    if (!hotelId)
      throw new UnauthorizedException('Invalid or revoked widget key.');
    return hotelId;
  }
}
