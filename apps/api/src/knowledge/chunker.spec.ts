import { ChunkerService } from './chunker.service';

describe('ChunkerService (IA §6)', () => {
  const chunker = new ChunkerService();

  it('keeps a short document as one chunk', () => {
    const chunks = chunker.chunk(
      'Complimentary Wi-Fi is available throughout the property.',
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('Complimentary Wi-Fi');
  });

  it('splits on blank-line paragraphs and attaches headings to the text under them', () => {
    const text = [
      '# Dining',
      '',
      'The Rooftop serves dinner only.',
      '',
      '# Spa',
      '',
      'Book a day ahead.',
    ].join('\n');
    const chunks = chunker.chunk(text);
    // Short enough to pack into one chunk, but headings must stay attached.
    expect(chunks[0].content).toContain('# Dining');
    expect(chunks[0].content).toContain('# Spa');
  });

  it('never splits a table across two chunks, even when it forces an oversized chunk', () => {
    const rows = Array.from(
      { length: 40 },
      (_, i) => `| Room ${i} | View ${i} | $${100 + i} |`,
    );
    const table = [
      '| Name | View | Rate |',
      '| --- | --- | --- |',
      ...rows,
    ].join('\n');
    const chunks = chunker.chunk(table);
    expect(chunks).toHaveLength(1);
    expect(
      chunks[0].content.split('\n').filter((l) => l.includes('|')),
    ).toHaveLength(rows.length + 2);
  });

  it('hard-splits an oversized non-table section on sentence boundaries', () => {
    const longProse = Array.from(
      { length: 80 },
      (_, i) => `This is sentence number ${i}.`,
    ).join(' ');
    const chunks = chunker.chunk(longProse);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks)
      expect(c.content.length).toBeLessThanOrEqual(450 * 4 + 50); // cap + small overlap slack
  });

  describe('isAtomic (findings-log.md #31)', () => {
    it('marks a whole-table chunk as atomic', () => {
      const table = [
        '| Treatment | Price |',
        '| --- | --- |',
        '| Massage | $180 |',
      ].join('\n');
      const chunks = chunker.chunk(table);
      expect(chunks[0].isAtomic).toBe(true);
    });

    it('marks plain prose as not atomic', () => {
      const chunks = chunker.chunk(
        'The hotel is pet-friendly for a nightly fee.',
      );
      expect(chunks[0].isAtomic).toBe(false);
    });

    it('marks a chunk that mixes prose with a packed-in table as atomic', () => {
      const text = [
        '# Rooms',
        '',
        'A short intro paragraph.',
        '',
        '| Name | Rate |',
        '| --- | --- |',
        '| Suite | $500 |',
      ].join('\n');
      const chunks = chunker.chunk(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].isAtomic).toBe(true);
    });

    it('marks hard-split pieces of oversized prose as not atomic', () => {
      const longProse = Array.from(
        { length: 80 },
        (_, i) => `This is sentence number ${i}.`,
      ).join(' ');
      const chunks = chunker.chunk(longProse);
      expect(chunks.every((c) => c.isAtomic === false)).toBe(true);
    });
  });

  describe('priority auto-assignment', () => {
    it('flags pricing/policy language as HIGH', () => {
      const chunks = chunker.chunk(
        'Cancellation is free up to 48 hours before arrival.',
      );
      expect(chunks[0].priority).toBe('HIGH');
    });

    it('flags brand-story language as LOW', () => {
      const chunks = chunker.chunk(
        'Welcome to our story — founded in 1968, our heritage runs deep.',
      );
      expect(chunks[0].priority).toBe('LOW');
    });

    it('defaults to NORMAL otherwise', () => {
      const chunks = chunker.chunk('The pool is open from 8am to 8pm daily.');
      expect(chunks[0].priority).toBe('NORMAL');
    });
  });
});
