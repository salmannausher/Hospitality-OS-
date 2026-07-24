import { Injectable, Logger } from '@nestjs/common';
import { generateObject, streamText } from 'ai';
import { z } from 'zod';
import type { ClassifierOutput } from '@hospitality/types';
import { PromptsService } from './prompts.service';

/**
 * The two Claude calls, routed through the Vercel AI Gateway (Architecture §7,
 * AI Engine §1). Model IDs are gateway `provider/model` strings so swapping a
 * tier is a config change, not a code change (AI Engine §2). The AI SDK reads
 * AI_GATEWAY_API_KEY from the environment automatically for string model ids.
 */
export const CLASSIFIER_MODEL = 'anthropic/claude-haiku-4.5'; // small/fast tier
export const GENERATION_MODEL = 'anthropic/claude-sonnet-5'; // primary tier
export const EXTRACTION_MODEL = 'anthropic/claude-haiku-4.5'; // ingestion structured extraction (AI Engine §1)

/** The nine+one entity types (DB EntityType / IA §3) the extractor may emit. */
const ENTITY_TYPES = [
  'RoomType',
  'Package',
  'Restaurant',
  'SpaTreatment',
  'Amenity',
  'Policy',
  'LocalRecommendation',
  'EventSpace',
  'Experience',
  'PropertyProfile',
] as const;

const DOMAIN_TAGS = [
  'accommodation',
  'booking',
  'dining',
  'spa',
  'property',
  'local_area',
  'policies',
  'events',
] as const;

/** entity-extraction.md's output (AI Engine §3): typed entities + doc-level domain tags. */
const extractionSchema = z.object({
  entities: z.array(
    z.object({
      type: z.enum(ENTITY_TYPES),
      name: z.string().nullable(),
      // Fields vary by type (IA §3); kept loose here and mapped to typed rows at
      // write time, leaving unknowns null (a missing required field → NEEDS_REVIEW).
      fields: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      ),
    }),
  ),
  domainTags: z.array(z.enum(DOMAIN_TAGS)),
});

export interface ExtractionResult {
  entities: Array<{
    type: (typeof ENTITY_TYPES)[number];
    name: string | null;
    fields: Record<string, string | number | boolean | null>;
  }>;
  domainTags: string[];
}

/** What the pipeline consumes from a streamed generation. */
export interface GenerationStream {
  textStream: AsyncIterable<string>;
  /** Non-null if the provider errored (the AI SDK surfaces stream errors here, not by throwing in textStream). */
  getError: () => unknown;
}

/** Mirrors @hospitality/types ClassifierOutput — the classifier's structured output (AI Engine §2). */
const classifierSchema = z.object({
  journeyState: z.enum([
    'information',
    'planning',
    'booking_intent',
    'service_recovery',
  ]),
  domain: z.array(
    z.enum([
      'accommodation',
      'booking',
      'dining',
      'spa',
      'property',
      'local_area',
      'policies',
      'events',
    ]),
  ),
  persona: z
    .enum([
      'luxury_traveler',
      'family_traveler',
      'business_traveler',
      'wedding_planner',
      'event_organizer',
    ])
    .nullable(),
  rewrittenQuery: z.string(),
  detectedSignals: z.object({
    occasion: z.string().nullable(),
    leadCaptureWorthy: z.boolean(),
    explicitHandoffRequest: z.boolean(),
  }),
});

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(private readonly prompts: PromptsService) {}

  /**
   * Classify one guest message (AI Engine §2). Returns the structured output;
   * on any failure (timeout, malformed JSON, provider error) returns the
   * documented safe default — Information state, empty domain, unrewritten
   * query — never retried mid-turn, since a retry would blow the latency budget.
   */
  async classify(
    message: string,
    history: string,
  ): Promise<{ classification: ClassifierOutput; degraded: boolean }> {
    try {
      const { object } = await generateObject({
        model: CLASSIFIER_MODEL,
        schema: classifierSchema,
        system: this.prompts.getClassifierPrompt(),
        prompt: `Recent conversation history:\n${history || '(none)'}\n\nGuest message: ${message}`,
      });
      return { classification: object, degraded: false };
    } catch (err) {
      this.logger.warn(
        `Classifier call failed — falling back to safe default: ${String(
          (err as Error)?.message ?? err,
        )}`,
      );
      return {
        classification: GatewayService.safeDefaultClassification(message),
        degraded: true,
      };
    }
  }

  /**
   * Stream a grounded generation (AI Engine §1 step 6). Returns the AI SDK
   * stream result — the caller iterates `.textStream` to emit `delta` events and
   * awaits `.text` for the stored Message content. Not called at all on the
   * Low-confidence path (AI Engine §5) — that returns the honest fallback
   * without a generation call.
   */
  streamGeneration(input: {
    systemPrompt: string;
    message: string;
  }): GenerationStream {
    let streamError: unknown = null;
    const result = streamText({
      model: GENERATION_MODEL,
      system: input.systemPrompt,
      prompt: input.message,
      onError: ({ error }) => {
        streamError = error;
        this.logger.error(
          `Generation stream error: ${String((error as Error)?.message ?? error)}`,
        );
      },
    });
    // Narrow to what the pipeline consumes — decouples callers from AI SDK
    // internal generic types (which also can't cross a declaration boundary).
    return { textStream: result.textStream, getError: () => streamError };
  }

  /**
   * Ingestion-side entity extraction + domain tagging (AI Engine §3, one call
   * returns both). Throws on failure — the worker catches it and marks the
   * document NEEDS_REVIEW (AI Engine §8), rather than silently indexing
   * ungrounded content.
   */
  async extractEntities(text: string): Promise<ExtractionResult> {
    const { object } = await generateObject({
      model: EXTRACTION_MODEL,
      schema: extractionSchema,
      system: this.prompts.getEntityExtractionPrompt(),
      prompt: `Source text:\n${text}`,
    });
    return object;
  }

  static safeDefaultClassification(message: string): ClassifierOutput {
    return {
      journeyState: 'information',
      domain: [],
      persona: null,
      rewrittenQuery: message,
      detectedSignals: {
        occasion: null,
        leadCaptureWorthy: false,
        explicitHandoffRequest: false,
      },
    };
  }
}
