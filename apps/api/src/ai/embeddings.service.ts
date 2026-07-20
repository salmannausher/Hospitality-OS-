import { Injectable, Logger } from '@nestjs/common';

/** Marks an error as not worth retrying — unwrapped and rethrown immediately. */
class NonRetryableError extends Error {
  constructor(public readonly cause: Error) {
    super(cause.message);
  }
}

/**
 * Voyage AI embeddings — the query-time and ingestion-time embedding call
 * (AI Engine §1 steps 3 / ingestion). Voyage, not OpenAI, deliberately
 * (CLAUDE.md). `voyage-4` outputs 1024 dimensions, matching `Chunk.embedding
 * vector(1024)` exactly (Sprint 0 confirmed this — docs/14 Sprint 0).
 *
 * Query embeddings and document (chunk) embeddings MUST use the same model, or
 * the vector spaces don't match and retrieval silently degrades (AI Engine §1).
 * The `inputType` param is Voyage's asymmetric-embedding hint, not a different
 * model — `query` for guest questions, `document` for indexed chunks.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly endpoint = 'https://api.voyageai.com/v1/embeddings';
  private readonly model = 'voyage-4';

  /** The dimension the Chunk.embedding column is declared as (vector(1024)). */
  static readonly DIMENSIONS = 1024;

  private get apiKey(): string {
    const key = process.env.VOYAGE_API_KEY;
    if (!key) throw new Error('VOYAGE_API_KEY is not set.');
    return key;
  }

  /**
   * Embed one or more texts. Returns vectors in the same order as `texts`.
   * Throws on a provider error — callers at query time degrade gracefully
   * (AI Engine §8: fall back to unrewritten lexical retrieval), callers at
   * ingestion time mark the document NEEDS_REVIEW.
   */
  async embed(
    texts: string[],
    inputType: 'query' | 'document',
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Retry transient failures — network errors, 429 (rate limit), and 5xx.
    // A genuine 400/401/403/404 will never succeed on retry, so fail fast
    // rather than burn the whole backoff budget for nothing.
    const MAX_ATTEMPTS = 6;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            input: texts,
            input_type: inputType,
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const retryable = res.status === 429 || res.status >= 500;
          this.logger.error(`Voyage embeddings failed: ${res.status} ${body}`);
          const err = new Error(
            `Voyage embeddings request failed (${res.status})`,
          );
          if (!retryable) throw new NonRetryableError(err);
          throw err;
        }

        const json = (await res.json()) as {
          data: Array<{ embedding: number[] }>;
        };
        return json.data.map((d) => d.embedding);
      } catch (err) {
        if (err instanceof NonRetryableError) throw err.cause;
        lastErr = err;
        if (attempt < MAX_ATTEMPTS)
          await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    this.logger.error(
      `Voyage embeddings failed after retries: ${String((lastErr as Error)?.message ?? lastErr)}`,
    );
    throw lastErr instanceof Error
      ? lastErr
      : new Error('Voyage embeddings failed');
  }

  /** Convenience for the single-query retrieval path (AI Engine §1 step 3). */
  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embed([text], 'query');
    return vector;
  }
}
