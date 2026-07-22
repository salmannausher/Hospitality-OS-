import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  BootstrapResponse,
  ChatSSEEvent,
  ConfidenceBand,
  JourneyState,
} from '@hospitality/types';
import { PrismaService } from '../common/prisma/prisma.service';
import { CardAssemblyService } from './card-assembly.service';
import { EmbeddingsService } from './embeddings.service';
import { GatewayService } from './gateway.service';
import { PromptsService } from './prompts.service';
import { RetrievalService, type RetrievedChunk } from './retrieval.service';
import {
  chunkAgreement,
  confidenceBand,
  confidenceScore,
  rerankScore,
} from './scoring';

/** Journey states in which a recommendation is ever appropriate (ABS §16/§18)
 * — never Information (answer only, no upsell needed) and never, ever,
 * Service Recovery (ABS §19: "Continue recommending... after a Service
 * Recovery journey state" is a forbidden behavior). */
const RECOMMENDATION_JOURNEY_STATES: readonly JourneyState[] = [
  'planning',
  'booking_intent',
];

/** Retrieve this many candidates, then keep the top N after reranking. */
const RETRIEVAL_LIMIT = 8;
const CONTEXT_TOP_N = 5;
/** Prior messages included as conversation context. */
const HISTORY_TURNS = 10;

/**
 * Placeholder classifier-certainty for the confidence formula (AI Engine §5).
 * The formula requires a classifier certainty, but the classifier's documented
 * output shape (AI Engine §2 / @hospitality/types ClassifierOutput) has no such
 * field — a genuine gap between the two spec sections. Rather than silently
 * change the shared contract, Sprint 1 uses classifier *health* as the signal:
 * a clean structured parse → 0.8, the safe-default fallback → 0.3. Retrieval
 * signals (0.5 similarity + 0.3 agreement) dominate confidence anyway; this
 * 0.2-weight term is minor. Proper fix (model-reported certainty on the
 * classifier schema) is a Sprint 3 follow-up when the classifier is revisited.
 */
const CERTAINTY_HEALTHY = 0.8;
const CERTAINTY_DEGRADED = 0.3;

/** ABS §6 honest fallback — used on the Low-confidence path, no generation call. */
const LOW_CONFIDENCE_FALLBACK =
  "I don't have confirmed information about that just yet, but I'd be glad to connect you with our team, who can give you an accurate answer.";

interface TonePreset {
  formalityLevel: string;
  brandAdjectives: string;
}

const TONE_MAP: Record<string, TonePreset> = {
  CLASSIC_LUXURY: {
    formalityLevel: 'formal and refined',
    brandAdjectives: 'gracious, polished, discreet',
  },
  MODERN_LUXURY: {
    formalityLevel: 'polished but relaxed',
    brandAdjectives: 'elegant, warm, effortless',
  },
  BOUTIQUE: {
    formalityLevel: 'friendly and characterful',
    brandAdjectives: 'personable, spirited, attentive',
  },
  FAMILY_FRIENDLY: {
    formalityLevel: 'warm and approachable',
    brandAdjectives: 'friendly, practical, reassuring',
  },
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly gateway: GatewayService,
    private readonly prompts: PromptsService,
    private readonly retrieval: RetrievalService,
    private readonly cardAssembly: CardAssemblyService,
  ) {}

  /** GET /v1/chat/bootstrap (API §2.4). One round trip to render the launcher. */
  async bootstrap(hotelId: string): Promise<BootstrapResponse> {
    return this.prisma.withTenant(hotelId, async (tx) => {
      const hotel = await tx.hotel.findFirstOrThrow({
        include: { brandSettings: true },
      });
      const brand = hotel.brandSettings;
      const tone = brand?.tonePreset ?? 'MODERN_LUXURY';
      return {
        hotel: {
          name: hotel.name,
          conciergeName: brand?.conciergeName ?? `${hotel.name} Concierge`,
        },
        brand: {
          tonePreset: tone,
          primaryColor: brand?.primaryColor ?? '#2F4A3C',
          fontFamily: brand?.fontFamily ?? '',
          logoUrl: brand?.logoUrl ?? '',
        },
        greeting:
          brand?.greeting ??
          `Welcome to ${hotel.name}. How may I help you today?`,
        // No schema home yet for these two — sensible Sprint 1 defaults
        // (a suggested-questions/quick-start config lands with the admin portal).
        suggestedQuestions: [
          'What time is breakfast?',
          'Do you allow pets?',
          'Which room is best for a couple?',
        ],
        quickStart: [],
        launcherDelayMs: 6000,
      };
    });
  }

  /**
   * POST /v1/chat/message (API §2.1). Yields the SSE event stream in protocol
   * order: ack → delta* → card? → done. `card` fires at most once, only after
   * the final `delta` (API §2.1's ordering guarantee — the answer always
   * completes before any side action, ABS §18) and only in the Planning /
   * Booking Intent journey states (ABS §16/§9), never Information (no upsell
   * needed) and never Service Recovery (ABS §19 forbids it outright).
   * Follows the guest-message pipeline (Architecture §4): classify → embed →
   * retrieve → rerank → confidence → (Low: honest fallback | else: grounded
   * generation) → recommendation bundle.
   */
  async *streamTurn(params: {
    hotelId: string;
    sessionId: string;
    conversationId: string | null;
    message: string;
    contextTag?: string | null;
  }): AsyncGenerator<ChatSSEEvent> {
    // ack fires IMMEDIATELY — before any Supabase round trip — so it lands well
    // inside the ≤300ms budget regardless of DB/model latency (API §2.1). The
    // conversation id is pre-generated here (not read back from an INSERT) so
    // the guest gets a stable id up front; the row is written just after.
    const conversationId =
      params.conversationId ?? `c_${randomUUID().replace(/-/g, '')}`;
    yield { type: 'ack', conversationId };

    // --- Turn open (short tx): ensure conversation, persist guest msg, read history.
    const history = await this.prisma.withTenant(params.hotelId, async (tx) =>
      this.openTurn(tx, { ...params, conversationId }),
    );

    // --- Classification (Architecture §4 step 2–4).
    const historyText = history
      .map((m) => `${m.role === 'GUEST' ? 'Guest' : 'Concierge'}: ${m.content}`)
      .join('\n');
    const { classification, degraded } = await this.gateway.classify(
      params.message,
      historyText,
    );

    // --- Embed + retrieve + rerank (steps 3–5). Degrade to unrewritten query on embed failure.
    let ranked: RetrievedChunk[] = [];
    try {
      const queryEmbedding = await this.embeddings.embedQuery(
        classification.rewrittenQuery || params.message,
      );
      ranked = await this.prisma.withTenant(params.hotelId, async (tx) => {
        const chunks = await this.retrieval.retrieve(tx, {
          queryEmbedding,
          domains: classification.domain,
          limit: RETRIEVAL_LIMIT,
        });
        const now = new Date();
        return [...chunks].sort(
          (a, b) =>
            rerankScore(
              {
                similarity: b.similarity,
                priority: b.priority,
                lastVerifiedAt: b.lastVerifiedAt,
              },
              now,
            ) -
            rerankScore(
              {
                similarity: a.similarity,
                priority: a.priority,
                lastVerifiedAt: a.lastVerifiedAt,
              },
              now,
            ),
        );
      });
    } catch (err) {
      this.logger.warn(
        `Retrieval degraded: ${String((err as Error)?.message ?? err)}`,
      );
    }

    const topChunks = ranked.slice(0, CONTEXT_TOP_N);

    // --- Confidence (step 6) — computed BEFORE generation (AI Engine §5).
    const similarities = ranked.map((c) => c.similarity);
    const score = confidenceScore({
      topSimilarity: similarities[0] ?? 0,
      agreement: chunkAgreement(similarities),
      classifierCertainty: degraded ? CERTAINTY_DEGRADED : CERTAINTY_HEALTHY,
    });
    const band = confidenceBand(score);

    // --- Answer (step 7). Low confidence → honest fallback, NO generation call.
    let answer = '';
    if (band === 'LOW' || topChunks.length === 0) {
      answer = LOW_CONFIDENCE_FALLBACK;
      yield { type: 'delta', text: answer };
    } else {
      const systemPrompt = await this.buildSystemPrompt({
        hotelId: params.hotelId,
        topChunks,
        historyText,
      });
      const result = this.gateway.streamGeneration({
        systemPrompt,
        message: params.message,
      });
      try {
        for await (const delta of result.textStream) {
          answer += delta;
          yield { type: 'delta', text: delta };
        }
      } catch (err) {
        this.logger.error(
          `Generation threw: ${String((err as Error)?.message ?? err)}`,
        );
      }
      // The AI SDK surfaces stream errors via onError, not by throwing in the
      // for-await — check both. Empty answer + an error → graceful fallback
      // (AI Engine §8 / UX §13), never a silent empty turn.
      if (result.getError() && answer.length === 0) {
        yield {
          type: 'error',
          error: {
            code: 'GENERATION_FAILED',
            message: 'The concierge is momentarily unavailable.',
            requestId: conversationId,
          },
        };
        return;
      }
    }

    // --- Recommendation bundle (API §2.1 `card` event, IA §12). Only after
    // the answer is complete (never instead of it — ABS §18), only in a
    // journey state where recommending is appropriate, and never on the
    // Low-Confidence fallback path (an unconfident answer earns no upsell).
    // `contextTag` prefers the guest's own quick-start tap (UX §2) over the
    // classifier's free-text occasion signal, since a tapped chip is the more
    // explicit of the two.
    const contextTag =
      params.contextTag || classification.detectedSignals.occasion;
    if (
      band !== 'LOW' &&
      contextTag &&
      RECOMMENDATION_JOURNEY_STATES.includes(classification.journeyState)
    ) {
      const cards = await this.cardAssembly.buildCards(
        params.hotelId,
        contextTag,
      );
      if (cards.length > 0) {
        yield { type: 'card', cards };
      }
    }

    // --- Persist concierge turn + log metadata (step 9).
    const messageId = await this.prisma.withTenant(params.hotelId, async (tx) =>
      this.persistConciergeTurn(tx, {
        hotelId: params.hotelId,
        conversationId,
        content: answer,
        journeyState: classification.journeyState,
        domainTags: classification.domain,
        band,
      }),
    );

    yield {
      type: 'done',
      messageId,
      journeyState: classification.journeyState,
      confidenceBand: band,
    };
  }

  // ---------------------------------------------------------------------------

  private async openTurn(
    tx: Prisma.TransactionClient,
    params: {
      hotelId: string;
      sessionId: string;
      conversationId: string;
      message: string;
    },
  ): Promise<Array<{ role: string; content: string }>> {
    // Create the conversation on first turn, or reuse it on later turns — keyed
    // on the id already sent in ack. RLS scopes this to the resolved hotel.
    await tx.conversation.upsert({
      where: { id: params.conversationId },
      create: {
        id: params.conversationId,
        hotelId: params.hotelId,
        guestSessionId: params.sessionId,
      },
      update: {},
    });

    // Prior turns (before this message) become the conversation context.
    const prior = await tx.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TURNS,
      select: { role: true, content: true },
    });

    await tx.message.create({
      data: {
        hotelId: params.hotelId,
        conversationId: params.conversationId,
        role: 'GUEST',
        content: params.message,
      },
    });

    return prior.reverse();
  }

  private async persistConciergeTurn(
    tx: Prisma.TransactionClient,
    input: {
      hotelId: string;
      conversationId: string;
      content: string;
      journeyState: JourneyState;
      domainTags: string[];
      band: ConfidenceBand;
    },
  ): Promise<string> {
    const created = await tx.message.create({
      data: {
        hotelId: input.hotelId,
        conversationId: input.conversationId,
        role: 'CONCIERGE',
        content: input.content,
        journeyState: input.journeyState,
        domainTags: input.domainTags,
        confidenceBand: input.band,
      },
    });
    return created.id;
  }

  private async buildSystemPrompt(input: {
    hotelId: string;
    topChunks: RetrievedChunk[];
    historyText: string;
  }): Promise<string> {
    const { hotelName, conciergeName, tone } = await this.prisma.withTenant(
      input.hotelId,
      async (tx) => {
        const hotel = await tx.hotel.findFirstOrThrow({
          include: { brandSettings: true },
        });
        return {
          hotelName: hotel.name,
          conciergeName:
            hotel.brandSettings?.conciergeName ?? `${hotel.name} Concierge`,
          tone:
            TONE_MAP[hotel.brandSettings?.tonePreset ?? 'MODERN_LUXURY'] ??
            TONE_MAP.MODERN_LUXURY,
        };
      },
    );

    const ragContext = input.topChunks
      .map((c, i) => `[${i + 1}] ${c.content}`)
      .join('\n\n');

    return this.prompts.assembleSystemPrompt({
      conciergeName,
      hotelName,
      formalityLevel: tone.formalityLevel,
      brandAdjectives: tone.brandAdjectives,
      ragContext: ragContext || '(no indexed content matched this question)',
      messageHistory: input.historyText || '(this is the first message)',
    });
  }
}
