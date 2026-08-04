import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Headers,
  HttpException,
  HttpStatus,
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
import { RateLimiterService } from './rate-limiter.service';

/** findings-log.md #39 — no documented number exists for these (Architecture
 * §10/API §4 only specify the request-rate limits below), so these are a
 * conservative judgment call: generous for any real guest message, tight
 * enough that a single request can't be used to push an unbounded payload
 * through embedding/generation. */
const MAX_MESSAGE_LENGTH = 4000;
const MAX_SESSION_ID_LENGTH = 200;

/**
 * Guest Chat API (API §2) — public, scoped by widget key, never trusting a
 * client-supplied hotel id. Tenant resolution (widgetKey → hotelId) is the one
 * lookup that precedes tenant context, via PrismaService.resolveWidgetKeyFull
 * (Architecture §4 step 1) — which also carries the key's per-origin allowlist
 * and feeds the per-key rate limit (findings-log.md #39).
 */
@Controller('v1/chat')
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly leads: LeadsService,
    private readonly escalationsService: EscalationsService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  // API §2.4 — GET /v1/chat/bootstrap
  @Get('bootstrap')
  async bootstrap(
    @Headers('x-widget-key') widgetKey: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const hotelId = await this.resolveHotel(widgetKey, origin, res);
    const payload = await this.chat.bootstrap(hotelId);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(payload);
  }

  // API §2.1 — POST /v1/chat/message (text/event-stream)
  @Post('message')
  async message(
    @Headers('x-widget-key') widgetKey: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Body()
    body: {
      sessionId?: string;
      conversationId?: string | null;
      message?: string;
      contextTag?: string | null;
    },
    @Res() res: Response,
  ): Promise<void> {
    const hotelId = await this.resolveHotel(widgetKey, origin, res);
    if (!body?.sessionId || !body?.message?.trim()) {
      throw new BadRequestException('sessionId and message are required.');
    }
    if (body.sessionId.length > MAX_SESSION_ID_LENGTH) {
      throw new BadRequestException('sessionId is too long.');
    }
    if (body.message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('message is too long.');
    }

    // Session limit is checked here (not in resolveHotel) — it's the one
    // limit keyed on something only this route's body carries, distinct
    // from the per-widget-key limit every route shares (API §4).
    const sessionCheck = await this.rateLimiter.checkSession(body.sessionId);
    if (!sessionCheck.allowed) {
      this.throwRateLimited(res, sessionCheck.retryAfterSeconds);
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
    @Headers('origin') origin: string | undefined,
    @Body()
    body: {
      conversationId?: string;
      promptId?: string;
      field?: unknown;
      value?: unknown;
      consent?: unknown;
      declined?: unknown;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const hotelId = await this.resolveHotel(widgetKey, origin, res);
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
    @Headers('origin') origin: string | undefined,
    @Body()
    body: {
      escalationId?: unknown;
      choice?: unknown;
      contact?: unknown;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const hotelId = await this.resolveHotel(widgetKey, origin, res);
    return this.escalationsService.choose(hotelId, {
      escalationId: body?.escalationId,
      choice: body?.choice,
      contact: body?.contact,
    });
  }

  /**
   * Resolves widgetKey → hotelId, then (findings-log.md #39):
   * 1. Per-key rate limit (`300 req/key/hour`, API §4) — shared by every
   *    route, since a leaked key can be replayed against any of them.
   * 2. Per-key origin allowlist — fail-OPEN when a key has no configured
   *    origins (the default for every key today, including the demo
   *    property), so nothing that already works breaks the moment this
   *    ships; fail-closed only once a hotel admin has actually set one.
   */
  private async resolveHotel(
    widgetKey: string | undefined,
    origin: string | undefined,
    res: Response,
  ): Promise<string> {
    if (!widgetKey) throw new UnauthorizedException('Missing X-Widget-Key.');
    const resolved = await this.prisma.resolveWidgetKeyFull(widgetKey);
    if (!resolved)
      throw new UnauthorizedException('Invalid or revoked widget key.');

    const keyCheck = await this.rateLimiter.checkWidgetKey(widgetKey);
    if (!keyCheck.allowed) {
      this.throwRateLimited(res, keyCheck.retryAfterSeconds);
    }

    if (
      resolved.allowedOrigins.length > 0 &&
      origin &&
      !resolved.allowedOrigins.includes(origin)
    ) {
      throw new ForbiddenException(
        'This widget key is not authorized for this origin.',
      );
    }

    return resolved.hotelId;
  }

  private throwRateLimited(res: Response, retryAfterSeconds: number): never {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
