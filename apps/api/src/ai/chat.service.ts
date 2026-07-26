import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  BootstrapResponse,
  ChatSSEEvent,
  ClassifierOutput,
  ConfidenceBand,
  CtaKind,
  JourneyState,
  RecommendationCard,
} from '@hospitality/types';
import { bumpDailyMetric } from '../analytics/daily-metrics';
import { PrismaService } from '../common/prisma/prisma.service';
import { EscalationsService } from '../escalations/escalations.service';
import { CardAssemblyService } from './card-assembly.service';
import { ctaForLifecycleStage } from './cta';
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

/** A trigger detectable BEFORE retrieval/generation ever run (ABS §7: "these
 * go to staff immediately, no AI attempt at resolution") — `journeyState:
 * service_recovery` already folds in complaints/safety/legal/in-house-issue
 * language (the classifier prompt's own instruction), so only the one
 * independent signal (an explicit ask for a human) needs checking separately.
 * Deliberately does NOT include the group/event-size threshold (findings-log.md
 * #9): unlike these two, Playbook G-09's own expected behavior wants the
 * concierge to actually engage first (share capacity facts, ask a clarifying
 * question via `wedding.md`) before handing off — generation still runs for
 * that trigger, so it's evaluated separately, after the answer exists. */
type PreAnswerEscalationReason = 'service_recovery' | 'explicit_request';

/** Every reason an `escalation` event can fire for, pre-answer or not. */
type EscalationReason =
  PreAnswerEscalationReason | 'low_confidence' | 'group_size_threshold';

/** Fallback if a hotel's `BrandSettings` row is somehow missing — matches the
 * schema's own default (migration `8_brand_settings_group_threshold`). */
const DEFAULT_GROUP_INQUIRY_THRESHOLD = 15;

/** One-sentence, in-character acknowledgments (ABS §7 point 1: "no dead air,
 * no 'processing' language") — never a troubleshooting attempt, never the
 * Low-Confidence copy (that's about not knowing an answer; this is about a
 * real problem or a direct ask, both handled identically once triggered). */
const PRE_ANSWER_ESCALATION_ACKNOWLEDGMENTS: Record<
  PreAnswerEscalationReason,
  string
> = {
  service_recovery:
    "I'm very sorry to hear that — let me connect you with our team right away so they can look into this for you.",
  explicit_request: 'Of course — let me connect you with our team right away.',
};

/** Journey states in which a recommendation is ever appropriate (ABS §16/§18)
 * — never Information (answer only, no upsell needed) and never, ever,
 * Service Recovery (ABS §19: "Continue recommending... after a Service
 * Recovery journey state" is a forbidden behavior). */
const RECOMMENDATION_JOURNEY_STATES: readonly JourneyState[] = [
  'planning',
  'booking_intent',
];

/** Lead capture (ABS §8) is signal-gated the same way a recommendation is —
 * dates/occasion/comparison signals only ever arise in these two states,
 * and asking for contact info during Information or (especially) Service
 * Recovery would be exactly the tone-deaf, form-like intrusion ABS §8/§18
 * warn against. */
const LEAD_PROMPT_JOURNEY_STATES: readonly JourneyState[] = [
  'planning',
  'booking_intent',
];

/** UX §4's own worked example — a Yes/No confirmation, reason stated in the
 * same breath, always precedes the first field ask. Kept generic (not
 * occasion-specific) since the signal can also fire from a plain comparison
 * (Playbook G-02), not just an occasion mention (G-05, G-18). */
const LEAD_PROMPT_QUESTION =
  'Would you like me to put together a tailored recommendation and send it your way?';

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
    private readonly escalations: EscalationsService,
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
   * order: ack → delta* → (escalation | card? and/or lead_prompt?) → done.
   * `escalation` and `card`/`lead_prompt` are mutually exclusive within a
   * turn — once any ABS §7 trigger fires (explicit request, Service Recovery,
   * Low Confidence, or a group/event inquiry over the hotel's configured size
   * threshold), card/lead_prompt are skipped entirely for that turn (ABS §19,
   * §8). `card` and `lead_prompt` themselves fire only in the Planning/
   * Booking Intent journey states (ABS §16/§9/§18), never Information.
   * Follows the guest-message pipeline (Architecture §4): classify →
   * (Service Recovery/explicit request? skip straight to acknowledgment) →
   * embed → retrieve → rerank → confidence → (Low: honest fallback, itself an
   * escalation trigger | else: grounded generation, then check the
   * group-size threshold on top) → recommendation bundle + lead capture.
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

    // --- Escalation trigger check (ABS §7), evaluated BEFORE retrieval/
    // generation: two of the three triggers mean skipping both entirely
    // ("no AI attempt at resolution" for Service Recovery / an explicit
    // request). The third (Low Confidence) can only be known after retrieval
    // + scoring, so it's assigned further down instead.
    const preAnswerReason = this.detectPreAnswerEscalation(classification);
    let escalationReason: EscalationReason | null = preAnswerReason;
    let band: ConfidenceBand;
    let answer = '';
    // ABS §7's group/event-size threshold (findings-log.md #9) — checked only
    // when nothing more urgent already fired (service_recovery/explicit_request
    // take priority per the classifier prompt's own instruction), since the
    // stronger triggers mean generation never even runs, making this moot.
    // Computed once here (not inline in both branches below) since it's the
    // SAME check whether the eventual reason ends up next to a real generated
    // answer or the honest Low-Confidence fallback.
    const groupSize = classification.detectedSignals.groupSize;
    const groupSizeExceeded =
      !preAnswerReason && groupSize != null
        ? await this.exceedsGroupSizeThreshold(params.hotelId, groupSize)
        : false;
    // `contextTag` prefers the guest's own quick-start tap (UX §2) over the
    // classifier's free-text occasion signal, since a tapped chip is the more
    // explicit of the two. Computed once, up front, since both the bundle
    // lookup below and the `card` event later need the same value.
    const contextTag =
      params.contextTag || classification.detectedSignals.occasion;
    // The relationship bundle (IA §12), resolved BEFORE generation (not after,
    // as Sprint 3 originally shipped it) so the model can be told exactly
    // which entities it must recommend — see the Golden Set run's card/text
    // divergence finding (docs/sprint-3-golden-set-run.md): card assembly and
    // RAG retrieval used to be two independent systems that could name
    // different entities in the same turn. Stays `[]` whenever a card
    // wouldn't fire anyway (pre-answer escalation, wrong journey state, no
    // contextTag) — computed once here, reused for the `card` event further
    // down rather than queried twice.
    let bundleCards: RecommendationCard[] = [];
    // `Message.leadCaptureTriggered` (DB §10, findings-log.md #14) — true only
    // when the `lead_prompt` SSE event actually fires this turn, set at the
    // exact point below where that event is yielded.
    let leadPromptFired = false;

    if (preAnswerReason) {
      // ABS §7 point 1: acknowledge in one sentence, no troubleshooting, no
      // dead air — then straight to the escalation event below.
      answer = PRE_ANSWER_ESCALATION_ACKNOWLEDGMENTS[preAnswerReason];
      yield { type: 'delta', text: answer };
      // Retrieval never ran, so there's no similarity signal to score — LOW is
      // still the accurate band: no confident automated answer was given.
      band = 'LOW';
    } else {
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
      band = confidenceBand(score);

      // --- Answer (step 7). Low confidence → honest fallback, NO generation
      // call, and — per ABS §5 — this band uses the escalation pattern too.
      // Exception: an ABS §10 refusal-category message (competitor comparison,
      // off-topic, prompt-extraction, medical/legal/financial advice,
      // harassment) never needed retrieval to begin with — no amount of
      // knowledge-base content changes the correct response, so low/empty
      // retrieval here isn't a real information gap (findings-log.md #11).
      // Generation always runs for these, and — deliberately — this isn't an
      // escalation-worthy "we don't know" moment either.
      if (
        (band === 'LOW' || topChunks.length === 0) &&
        !classification.detectedSignals.offTopicOrRefusal
      ) {
        answer = LOW_CONFIDENCE_FALLBACK;
        yield { type: 'delta', text: answer };
        // `group_size_threshold` is the more specific, structured reason —
        // report it over `low_confidence` when both apply (findings-log.md
        // #9's whole point: the logged reason should reflect the real cause,
        // e.g. a 120-guest wedding inquiry against a hotel with no indexed
        // `events` content, not an incidental empty-retrieval side effect).
        escalationReason = groupSizeExceeded
          ? 'group_size_threshold'
          : 'low_confidence';
      } else {
        if (
          contextTag &&
          RECOMMENDATION_JOURNEY_STATES.includes(classification.journeyState)
        ) {
          bundleCards = await this.cardAssembly.buildCards(
            params.hotelId,
            contextTag,
          );
        }
        const systemPrompt = await this.buildSystemPrompt({
          hotelId: params.hotelId,
          topChunks,
          historyText,
          domain: classification.domain,
          persona: classification.persona,
          bundleCards,
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

        // A real, grounded answer was just given (Playbook G-09's own
        // expectation: share capacity/facts, ask a clarifying question — not
        // "zero AI attempt" like service_recovery/explicit_request) — the
        // group-size threshold only adds the escalation on top, it never
        // replaces the answer that already streamed.
        if (groupSizeExceeded) {
          escalationReason = 'group_size_threshold';
        }
      }
    }

    if (escalationReason) {
      // --- Escalation (API §2.1 `escalation` event, ABS §7). Fires at most
      // once, after the acknowledgment/fallback delta, and — critically —
      // this branch is the ONLY reason card/lead_prompt below don't run: ABS
      // §19 forbids any recommendation once escalation has fired, and ABS §8
      // folds contact capture into the handoff itself rather than a separate ask.
      const escalationId = await this.escalations.create(
        params.hotelId,
        conversationId,
        escalationReason,
      );
      yield {
        type: 'escalation',
        escalationId,
        reason: escalationReason,
        // No live-staff channel exists in V1 (Architecture/API §5) — only ever
        // offer the path that's actually real, never a dead "connect now" button.
        options: ['contact_me'],
        liveStaffAvailable: false,
      };
    } else {
      // --- Recommendation bundle (API §2.1 `card` event, IA §12). Only after
      // the answer is complete (never instead of it — ABS §18). `bundleCards`
      // was already resolved above, before generation, so this is the exact
      // same bundle the system prompt was told to recommend — not a second,
      // independent lookup that could drift from what the text says.
      if (bundleCards.length > 0) {
        yield { type: 'card', cards: bundleCards };
      }

      // --- Lead capture prompt (API §2.1/§2.2 `lead_prompt` event, ABS §8, UX
      // §4). Never ask twice in the same conversation (ABS §8: "if the guest
      // declines, do not ask again" — generalized here to "don't re-offer at
      // all once asked," since a Lead row's mere existence for this
      // conversation is what remembers that). Only the Yes/No trigger is a
      // server-pushed SSE event; every subsequent field-by-field step happens
      // entirely inside `POST /v1/chat/lead`'s own request/response cycle
      // (`nextField` tells the client what to ask next, API §2.2).
      if (
        classification.detectedSignals.leadCaptureWorthy &&
        LEAD_PROMPT_JOURNEY_STATES.includes(classification.journeyState)
      ) {
        const alreadyAsked = await this.prisma.withTenant(
          params.hotelId,
          (tx) =>
            tx.lead.findFirst({ where: { conversationId, deletedAt: null } }),
        );
        if (!alreadyAsked) {
          leadPromptFired = true;
          yield {
            type: 'lead_prompt',
            promptId: `lp_${randomUUID().replace(/-/g, '')}`,
            question: LEAD_PROMPT_QUESTION,
            field: 'dates',
          };
        }
      }
    }

    // --- CTA (API §2.1 `cta` event, UX §6). Unconditional — every turn gets
    // exactly one, unlike card/lead_prompt/escalation which are conditional
    // on signals. Orthogonal to the escalation branch above: even a
    // Service-Recovery/escalated turn gets a CTA (request_assistance, per the
    // Staying-stage row of UX §6's own table — that IS the escalation-
    // appropriate CTA, not something escalation should suppress).
    const ctaKind = ctaForLifecycleStage(
      classification.detectedSignals.lifecycleStage,
    );
    yield {
      type: 'cta',
      kind: ctaKind,
      url: await this.resolveCtaUrl(params.hotelId, ctaKind),
    };

    // --- Persist concierge turn + log metadata (step 9).
    const messageId = await this.prisma.withTenant(params.hotelId, async (tx) =>
      this.persistConciergeTurn(tx, {
        hotelId: params.hotelId,
        conversationId,
        content: answer,
        journeyState: classification.journeyState,
        domainTags: classification.domain,
        band,
        escalationTriggered: escalationReason !== null,
        leadCaptureTriggered: leadPromptFired,
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

  /** ABS §7's triggers that are knowable immediately from the classifier's
   * output, before any retrieval/generation runs. `service_recovery` already
   * covers complaints, safety/medical/legal language, and in-house guest
   * issues — the classifier prompt folds all of those into that one journey
   * state. `explicitHandoffRequest` is the one signal independent of journey
   * state (a guest can ask for a human while just browsing). The group/event
   * size threshold is a real ABS §7 trigger too (findings-log.md #9) but
   * deliberately NOT included here — see `EscalationReason`'s doc comment for
   * why it's evaluated after generation instead. */
  private detectPreAnswerEscalation(
    classification: ClassifierOutput,
  ): PreAnswerEscalationReason | null {
    if (classification.journeyState === 'service_recovery') {
      return 'service_recovery';
    }
    if (classification.detectedSignals.explicitHandoffRequest) {
      return 'explicit_request';
    }
    return null;
  }

  /**
   * The `cta` event's `url` (API §2.1, UX §6). `BrandSettings.bookingEngineUrl`
   * is the one hotel-configurable link in the schema (added alongside this
   * ticket, discussed with the user first — no booking-engine integration
   * exists, PRD §19, so this is a plain admin-set external URL, not derived
   * from anything else). `book_now`/`explore_rooms` both point to it — most
   * real hotel sites route both into the same booking engine, just different
   * funnel framing. `plan_my_stay` falls back to the same URL as an honest
   * interim decision (many booking engines expose a "manage my booking" area
   * from the same domain) — a dedicated itinerary/local-guide URL is a real
   * gap, not solved here. `request_assistance` is never a real link — UX §6
   * frames it as routing "toward escalation/staff, not marketing," meant to
   * trigger the widget's own escalation UI once one exists, not link out.
   * Unconfigured (`bookingEngineUrl` null) → empty string, never a fake link.
   */
  private async resolveCtaUrl(hotelId: string, kind: CtaKind): Promise<string> {
    if (kind === 'request_assistance') return '';
    const bookingEngineUrl = await this.prisma.withTenant(hotelId, (tx) =>
      tx.brandSettings
        .findUnique({ where: { hotelId } })
        .then((b) => b?.bookingEngineUrl ?? null),
    );
    return bookingEngineUrl ?? '';
  }

  /** ABS §7's group/event-size threshold (findings-log.md #9) —
   * `BrandSettings.groupInquiryThreshold` is the per-hotel configurable
   * number; a stated guest count strictly above it routes to sales. */
  private async exceedsGroupSizeThreshold(
    hotelId: string,
    groupSize: number,
  ): Promise<boolean> {
    const threshold = await this.prisma.withTenant(hotelId, (tx) =>
      tx.brandSettings
        .findUnique({ where: { hotelId } })
        .then(
          (b) => b?.groupInquiryThreshold ?? DEFAULT_GROUP_INQUIRY_THRESHOLD,
        ),
    );
    return groupSize > threshold;
  }

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

    // Dashboard `conversationCount` rollup (findings-log.md #12) — a brand
    // new conversation has zero prior messages by definition, so `prior`
    // (already being fetched for history above) doubles as the "is this
    // new?" check with no extra query — deliberately not a separate
    // `findUnique` before the upsert, which would add another round trip to
    // an already-tight transaction under this environment's documented
    // pooler-timeout pressure (CLAUDE.md's own P2028 note).

    await bumpDailyMetric(tx, params.hotelId, {
      messageCount: 1,
      conversationCount: prior.length === 0 ? 1 : 0,
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
      escalationTriggered: boolean;
      leadCaptureTriggered: boolean;
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
        escalationTriggered: input.escalationTriggered,
        leadCaptureTriggered: input.leadCaptureTriggered,
      },
    });

    await bumpDailyMetric(tx, input.hotelId, {
      messageCount: 1,
      bookingIntentCount: input.journeyState === 'booking_intent' ? 1 : 0,
    });

    return created.id;
  }

  private async buildSystemPrompt(input: {
    hotelId: string;
    topChunks: RetrievedChunk[];
    historyText: string;
    domain: ClassifierOutput['domain'];
    persona: ClassifierOutput['persona'];
    bundleCards: RecommendationCard[];
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

    const retrievedContext = input.topChunks
      .map((c, i) => `[${i + 1}] ${c.content}`)
      .join('\n\n');

    // Folded into the existing {{rag_context}} slot rather than a new base.md
    // placeholder — base.md/ABS §14 is a shared prompt-template contract
    // (Prompt Library Prompt 0: copy it verbatim, flag rather than silently
    // change it), so this stays a chat.service.ts-local concern. When a
    // relationship bundle (IA §12) fired, the model is told exactly which
    // entities it must recommend — this is what keeps the `card` event and
    // the generated text naming the same things (Golden Set G-05 finding,
    // docs/sprint-3-golden-set-run.md).
    const bundleInstruction =
      input.bundleCards.length > 0
        ? `Curated recommendation already selected for this guest — your answer MUST recommend precisely these, not alternatives:\n${input.bundleCards
            .map((c) => `- ${c.title}${c.hook ? ` (${c.hook})` : ''}`)
            .join('\n')}\n\n`
        : '';
    const ragContext = bundleInstruction + retrievedContext;

    return this.prompts.assembleSystemPrompt({
      conciergeName,
      hotelName,
      formalityLevel: tone.formalityLevel,
      brandAdjectives: tone.brandAdjectives,
      domain: input.domain,
      persona: input.persona,
      ragContext: ragContext || '(no indexed content matched this question)',
      messageHistory: input.historyText || '(this is the first message)',
    });
  }
}
