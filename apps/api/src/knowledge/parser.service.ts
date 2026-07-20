import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';

/** Maps to the Prisma DocumentSourceType enum (TEXT covers .txt and .md). */
export type ParsedSourceType = 'PDF' | 'DOCX' | 'TEXT';

export interface ParsedDocument {
  text: string;
  sourceType: ParsedSourceType;
}

/**
 * Format detection & parsing — the first ingestion stage (IA §4–5). PDFs use
 * table-aware text extraction (pdf-parse v2), DOCX via mammoth, plain text and
 * Markdown ingest directly. Images/video are Future (V2/V3), not handled here.
 */
@Injectable()
export class ParserService {
  async parse(filename: string, buffer: Buffer): Promise<ParsedDocument> {
    const ext = filename.toLowerCase().split('.').pop() ?? '';
    switch (ext) {
      case 'pdf':
        return { text: await this.parsePdf(buffer), sourceType: 'PDF' };
      case 'docx':
        return { text: await this.parseDocx(buffer), sourceType: 'DOCX' };
      case 'txt':
      case 'md':
      case 'markdown':
        return { text: buffer.toString('utf8'), sourceType: 'TEXT' };
      default:
        throw new Error(`Unsupported source type: .${ext}`);
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    // Lazy import — pdf-parse loads a native canvas binding; defer it so it only
    // loads when a PDF is actually parsed, not at app boot.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
}
