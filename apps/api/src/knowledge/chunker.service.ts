import { Injectable } from '@nestjs/common';
import type { ChunkPriority } from '../ai/scoring';

/**
 * Semantic chunking (IA §6) — split on natural boundaries first (headings,
 * blank-line paragraphs, table blocks), fall back to a token cap only when a
 * section runs long, keep tables atomic (a split mid-price-table is a top cause
 * of hallucinated prices), and carry a small overlap between adjacent chunks.
 *
 * Pure/deterministic and unit-tested (chunker.spec.ts) — no model call. Priority
 * is auto-assigned by content signal (IA §6: policies/pricing → HIGH, brand
 * story → LOW), and is admin-overridable later.
 */
export interface Chunk {
  content: string;
  tokenCount: number;
  priority: ChunkPriority;
  /** True when this chunk contains a whole table segment kept atomic (never
   * split, see the class comment) — findings-log.md #31: the confidence
   * formula's "lone hit" distrust doesn't apply to these. */
  isAtomic: boolean;
}

interface Segment {
  text: string;
  isTable: boolean;
}

/** ~4 chars per token is a good-enough estimate for budgeting (no tokenizer dep). */
const CHARS_PER_TOKEN = 4;
const MAX_TOKENS = 450; // within IA §6's ~300–500 cap
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_RATIO = 0.12; // ~12%, within IA §6's 10–15%

const HIGH_SIGNAL =
  /(polic|cancel|refund|deposit|check[-\s]?in|check[-\s]?out|\$|\brate\b|\bprice\b|\bfee\b|per night)/i;
const LOW_SIGNAL =
  /(award|our story|our history|founded|heritage|gallery|about us|welcome to)/i;

@Injectable()
export class ChunkerService {
  chunk(text: string): Chunk[] {
    const segments = this.segment(text);

    // Greedily pack segments into chunks up to the token cap; never split a
    // table segment; hard-split any single oversized non-table segment. A
    // packed chunk is atomic if any segment feeding it was a whole table —
    // that guarantees no other chunk holds a continuation of the same table.
    const packed: { content: string; isAtomic: boolean }[] = [];
    let current = '';
    let currentIsAtomic = false;
    const flush = () => {
      if (current.trim())
        packed.push({ content: current.trim(), isAtomic: currentIsAtomic });
      current = '';
      currentIsAtomic = false;
    };

    for (const seg of segments) {
      if (seg.text.length > MAX_CHARS && !seg.isTable) {
        flush();
        for (const piece of hardSplit(seg.text))
          packed.push({ content: piece, isAtomic: false });
        continue;
      }
      if (current.length + seg.text.length > MAX_CHARS) flush();
      current = current ? `${current}\n\n${seg.text}` : seg.text;
      currentIsAtomic = currentIsAtomic || seg.isTable;
    }
    flush();

    // Add a small overlap: prepend the tail of the previous chunk.
    const withOverlap = packed.map((p, i) => {
      if (i === 0) return p;
      const prev = packed[i - 1].content;
      const overlap = prev.slice(-Math.floor(prev.length * OVERLAP_RATIO));
      const tail = overlap.slice(overlap.indexOf(' ') + 1); // start at a word boundary
      return { ...p, content: tail ? `…${tail}\n\n${p.content}` : p.content };
    });

    return withOverlap.map(({ content, isAtomic }) => ({
      content,
      tokenCount: Math.ceil(content.length / CHARS_PER_TOKEN),
      priority: this.priorityFor(content),
      isAtomic,
    }));
  }

  /**
   * Break text into natural segments: table blocks stay whole; otherwise split
   * on blank lines, keeping each Markdown heading attached to the text under it.
   */
  private segment(text: string): Segment[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const segments: Segment[] = [];
    let buf: string[] = [];
    let tableBuf: string[] = [];

    const flushBuf = () => {
      const joined = buf.join('\n').trim();
      if (joined) segments.push({ text: joined, isTable: false });
      buf = [];
    };
    const flushTable = () => {
      if (tableBuf.length) {
        segments.push({ text: tableBuf.join('\n').trim(), isTable: true });
        tableBuf = [];
      }
    };

    for (const line of lines) {
      const isTableRow = line.includes('|') && line.trim().length > 0;
      if (isTableRow) {
        flushBuf();
        tableBuf.push(line);
        continue;
      }
      flushTable();
      if (line.trim() === '') {
        flushBuf();
      } else if (/^#{1,6}\s/.test(line)) {
        // A heading starts a new segment.
        flushBuf();
        buf.push(line);
      } else {
        buf.push(line);
      }
    }
    flushTable();
    flushBuf();
    return segments;
  }

  private priorityFor(content: string): ChunkPriority {
    if (HIGH_SIGNAL.test(content)) return 'HIGH';
    if (LOW_SIGNAL.test(content)) return 'LOW';
    return 'NORMAL';
  }
}

/** Hard-split an oversized prose segment on sentence boundaries within the cap. */
function hardSplit(segment: string): string[] {
  const sentences = segment.match(/[^.!?]+[.!?]+|\S+$/g) ?? [segment];
  const out: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > MAX_CHARS && current) {
      out.push(current.trim());
      current = '';
    }
    current += s;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
