import {
  chunkAgreement,
  confidenceBand,
  confidenceScore,
  priorityWeight,
  recencyWeight,
  rerankScore,
  RECENCY_HALF_LIFE_DAYS,
} from './scoring';

const DAY_MS = 86_400_000;

describe('rerank scoring (AI Engine §4)', () => {
  const now = new Date('2026-07-20T00:00:00Z');

  it('maps priority to its weight', () => {
    expect(priorityWeight('HIGH')).toBe(1.0);
    expect(priorityWeight('NORMAL')).toBe(0.5);
    expect(priorityWeight('LOW')).toBe(0.0);
  });

  it('recency is 1.0 for fresh content and 0.5 at one half-life', () => {
    expect(recencyWeight(now, now)).toBe(1.0);
    const oneHalfLifeAgo = new Date(
      now.getTime() - RECENCY_HALF_LIFE_DAYS * DAY_MS,
    );
    expect(recencyWeight(oneHalfLifeAgo, now)).toBeCloseTo(0.5, 10);
  });

  it('recency never goes negative and clamps future dates to fresh', () => {
    const future = new Date(now.getTime() + 30 * DAY_MS);
    expect(recencyWeight(future, now)).toBe(1.0);
    const veryOld = new Date(now.getTime() - 3650 * DAY_MS);
    expect(recencyWeight(veryOld, now)).toBeGreaterThan(0);
  });

  it('computes the exact weighted score', () => {
    // 0.65·0.8 + 0.20·1.0 (HIGH) + 0.15·1.0 (fresh) = 0.52 + 0.20 + 0.15 = 0.87
    const score = rerankScore(
      { similarity: 0.8, priority: 'HIGH', lastVerifiedAt: now },
      now,
    );
    expect(score).toBeCloseTo(0.87, 10);
  });

  it('a HIGH-priority chunk outranks a NORMAL one at equal similarity and recency', () => {
    const hi = rerankScore(
      { similarity: 0.7, priority: 'HIGH', lastVerifiedAt: now },
      now,
    );
    const norm = rerankScore(
      { similarity: 0.7, priority: 'NORMAL', lastVerifiedAt: now },
      now,
    );
    expect(hi).toBeGreaterThan(norm);
  });
});

describe('chunk agreement (AI Engine §5)', () => {
  it('is 0 for a single lone hit (outlier, no corroboration)', () => {
    expect(chunkAgreement([0.9])).toBe(0);
    expect(chunkAgreement([])).toBe(0);
  });

  it('is high when runners-up nearly match the top hit', () => {
    expect(chunkAgreement([0.9, 0.88, 0.87])).toBeGreaterThan(0.9);
  });

  it('is low when the top hit dwarfs the rest', () => {
    expect(chunkAgreement([0.9, 0.2, 0.1])).toBeLessThan(0.25);
  });

  it('does not require pre-sorted input', () => {
    expect(chunkAgreement([0.2, 0.9, 0.88])).toBeCloseTo(
      chunkAgreement([0.9, 0.88, 0.2]),
      10,
    );
  });
});

describe('confidence scoring (AI Engine §5)', () => {
  it('computes the exact weighted score', () => {
    // 0.5·0.8 + 0.3·0.9 + 0.2·0.7 = 0.40 + 0.27 + 0.14 = 0.81
    const score = confidenceScore({
      topSimilarity: 0.8,
      agreement: 0.9,
      classifierCertainty: 0.7,
    });
    expect(score).toBeCloseTo(0.81, 10);
  });

  it('bands on the documented thresholds', () => {
    expect(confidenceBand(0.75)).toBe('HIGH');
    expect(confidenceBand(0.9)).toBe('HIGH');
    expect(confidenceBand(0.74999)).toBe('MEDIUM');
    expect(confidenceBand(0.5)).toBe('MEDIUM');
    expect(confidenceBand(0.49999)).toBe('LOW');
    expect(confidenceBand(0)).toBe('LOW');
  });

  it('clamps out-of-range inputs rather than producing an out-of-band score', () => {
    const score = confidenceScore({
      topSimilarity: 2,
      agreement: -1,
      classifierCertainty: 5,
    });
    // clamps to topSimilarity=1, agreement=0, certainty=1 → 0.5 + 0 + 0.2 = 0.7
    expect(score).toBeCloseTo(0.7, 10);
  });
});
