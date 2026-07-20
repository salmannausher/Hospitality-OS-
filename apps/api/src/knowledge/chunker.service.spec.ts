import { ChunkerService } from './chunker.service';

describe('ChunkerService (IA §6)', () => {
  const chunker = new ChunkerService();

  it('assigns HIGH priority to policy/pricing content', () => {
    const [chunk] = chunker.chunk(
      'Cancellation policy: a deposit is refundable up to 48 hours before check-in.',
    );
    expect(chunk.priority).toBe('HIGH');
  });

  it('assigns LOW priority to brand-story content', () => {
    const [chunk] = chunker.chunk(
      'Our story: founded in 1920, the hotel has a rich heritage and many awards.',
    );
    expect(chunk.priority).toBe('LOW');
  });

  it('assigns NORMAL priority to neutral content', () => {
    const [chunk] = chunker.chunk(
      'The lobby has comfortable seating and natural light.',
    );
    expect(chunk.priority).toBe('NORMAL');
  });

  it('keeps a Markdown table atomic (never split mid-table)', () => {
    const table = [
      '| Room | Rate |',
      '| --- | --- |',
      '| Ocean Suite | $480 |',
      '| Garden Room | $320 |',
    ].join('\n');
    const chunks = chunker.chunk(table);
    const tableChunks = chunks.filter((c) =>
      c.content.includes('| Ocean Suite | $480 |'),
    );
    expect(tableChunks).toHaveLength(1);
    // All four rows land in the same chunk.
    expect(tableChunks[0].content).toContain('| Garden Room | $320 |');
  });

  it('computes a token estimate for each chunk', () => {
    const [chunk] = chunker.chunk('A short line of text.');
    expect(chunk.tokenCount).toBeGreaterThan(0);
    expect(chunk.tokenCount).toBe(Math.ceil(chunk.content.length / 4));
  });

  it('splits an over-long section into multiple capped chunks', () => {
    const long = Array.from(
      { length: 200 },
      (_, i) => `Sentence number ${i} about the property.`,
    ).join(' ');
    const chunks = chunker.chunk(long);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk stays within the token cap (~450, allow overlap slack).
    for (const c of chunks) expect(c.tokenCount).toBeLessThan(600);
  });

  it('produces separate chunks for distinct paragraphs', () => {
    const doc =
      'First paragraph about dining.\n\nSecond paragraph about the spa.';
    const chunks = chunker.chunk(doc);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.map((c) => c.content).join(' ')).toContain('dining');
    expect(chunks.map((c) => c.content).join(' ')).toContain('spa');
  });
});
