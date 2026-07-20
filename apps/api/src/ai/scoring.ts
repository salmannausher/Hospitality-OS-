import type { ConfidenceBand } from '@hospitality/types';

/**
 * Deterministic scoring — the rerank formula (AI Engine §4) and the confidence
 * formula (AI Engine §5). Both are pure functions, deliberately isolated from
 * the request handler and unit-tested (scoring.spec.ts): they are the two places
 * a silent weighting bug would corrupt every answer, and they are the two things
 * the backlog specifically calls out to test in isolation (docs/14 Sprint 1).
 *
 * Neither is a model call. Reranking is weighted scoring, not a cross-encoder;
 * confidence is computed from retrieval signals BEFORE generation, so a
 * Low-confidence turn skips the generation model entirely (AI Engine §4–5).
 */

// ── Rerank: score = 0.65·similarity + 0.20·priority + 0.15·recency (AI Engine §4)
export const RERANK_WEIGHTS = {
  similarity: 0.65,
  priority: 0.2,
  recency: 0.15,
};

export type ChunkPriority = 'HIGH' | 'NORMAL' | 'LOW';

/** Priority → [0,1] boost. HIGH content (e.g. curated policies) outranks stale filler at equal similarity. */
export function priorityWeight(priority: ChunkPriority): number {
  switch (priority) {
    case 'HIGH':
      return 1.0;
    case 'NORMAL':
      return 0.5;
    case 'LOW':
      return 0.0;
  }
}

/** Recency half-life in days — a chunk verified `RECENCY_HALF_LIFE_DAYS` ago scores 0.5 on recency. */
export const RECENCY_HALF_LIFE_DAYS = 180;

/**
 * Recency → [0,1], exponential decay from lastVerifiedAt (AI Engine §4). `now`
 * is injected so this stays pure and testable. Fresh content → 1.0; it never
 * goes negative or below 0.
 */
export function recencyWeight(lastVerifiedAt: Date, now: Date): number {
  const ageMs = now.getTime() - lastVerifiedAt.getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

export interface RerankInput {
  similarity: number; // cosine similarity in [0,1]
  priority: ChunkPriority;
  lastVerifiedAt: Date;
}

/** The rerank score for one candidate chunk (AI Engine §4). */
export function rerankScore(input: RerankInput, now: Date): number {
  return (
    RERANK_WEIGHTS.similarity * clamp01(input.similarity) +
    RERANK_WEIGHTS.priority * priorityWeight(input.priority) +
    RERANK_WEIGHTS.recency * recencyWeight(input.lastVerifiedAt, now)
  );
}

// ── Confidence: 0.5·topSimilarity + 0.3·agreement + 0.2·classifierCertainty (AI Engine §5)
export const CONFIDENCE_WEIGHTS = {
  topSimilarity: 0.5,
  agreement: 0.3,
  classifierCertainty: 0.2,
};

export const CONFIDENCE_THRESHOLDS = { high: 0.75, medium: 0.5 };

/** Number of top chunks considered when measuring agreement. */
export const AGREEMENT_TOP_K = 5;

/**
 * Chunk agreement (AI Engine §5): how tightly the top-k retrieved chunks
 * corroborate the top hit. Defined as the mean similarity of the runners-up
 * relative to the top chunk — several near-equal chunks → high agreement; a
 * single lone hit → 0 (the top hit is an unsupported outlier, which should
 * reduce trust even when its raw similarity looks fine). `similarities` need
 * not be pre-sorted.
 */
export function chunkAgreement(similarities: number[]): number {
  if (similarities.length < 2) return 0;
  const sorted = [...similarities].map(clamp01).sort((a, b) => b - a);
  const top = sorted[0];
  if (top <= 0) return 0;
  const runnersUp = sorted.slice(1, AGREEMENT_TOP_K);
  const mean = runnersUp.reduce((s, v) => s + v, 0) / runnersUp.length;
  return clamp01(mean / top);
}

export interface ConfidenceInput {
  topSimilarity: number; // best cosine similarity among retrieved chunks
  agreement: number; // chunkAgreement() output
  classifierCertainty: number; // [0,1] from the classifier step (see §5)
}

/** The scalar confidence value (AI Engine §5). */
export function confidenceScore(input: ConfidenceInput): number {
  return (
    CONFIDENCE_WEIGHTS.topSimilarity * clamp01(input.topSimilarity) +
    CONFIDENCE_WEIGHTS.agreement * clamp01(input.agreement) +
    CONFIDENCE_WEIGHTS.classifierCertainty * clamp01(input.classifierCertainty)
  );
}

/** High ≥ 0.75 · Medium ≥ 0.5 · Low < 0.5 (AI Engine §5). */
export function confidenceBand(score: number): ConfidenceBand {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'HIGH';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'MEDIUM';
  return 'LOW';
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
