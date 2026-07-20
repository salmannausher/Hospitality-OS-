import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Loads and composes the versioned prompt library (packages/prompts, AI Engine
 * §3). The .md files are runtime assets read from the filesystem, not module
 * imports — the prompts package ships raw source, and reading the files keeps
 * this working regardless of how the api is bundled.
 *
 * Sprint 1 wires base.md + the general.md module + classifier.md only. The
 * domain/persona modules (wedding, spa, family-travel, business-travel) compose
 * in at Sprint 3 (docs/14-sprint-backlog.md).
 */
@Injectable()
export class PromptsService {
  private readonly root: string;
  private readonly cache = new Map<string, string>();

  constructor() {
    // Locate the symlinked @hospitality/prompts package directory. Its
    // package.json has no "exports" restriction, so subpath resolution works.
    const pkgJsonPath = require.resolve('@hospitality/prompts/package.json');
    this.root = dirname(pkgJsonPath);
  }

  private read(relPath: string): string {
    const cached = this.cache.get(relPath);
    if (cached !== undefined) return cached;
    const contents = readFileSync(join(this.root, relPath), 'utf8');
    this.cache.set(relPath, contents);
    return contents;
  }

  /** The classifier system prompt (AI Engine §2), verbatim. */
  getClassifierPrompt(): string {
    return this.read('classifier.md');
  }

  /** The ingestion-time entity-extraction system prompt (AI Engine §3), verbatim. */
  getEntityExtractionPrompt(): string {
    return this.read('entity-extraction.md');
  }

  /**
   * Assemble the generation system prompt: base.md (always) with its template
   * variables filled, and general.md as the single injected module for Sprint 1.
   */
  assembleSystemPrompt(input: {
    conciergeName: string;
    hotelName: string;
    formalityLevel: string;
    brandAdjectives: string;
    ragContext: string;
    messageHistory: string;
  }): string {
    const base = this.read('base.md');
    const modules = this.read('modules/general.md');
    return base
      .replaceAll('{{concierge_name}}', input.conciergeName)
      .replaceAll('{{hotel_name}}', input.hotelName)
      .replaceAll('{{formality_level}}', input.formalityLevel)
      .replaceAll('{{brand_adjectives}}', input.brandAdjectives)
      .replaceAll('{{modules}}', modules.trim())
      .replaceAll('{{rag_context}}', input.ragContext)
      .replaceAll('{{message_history}}', input.messageHistory);
  }
}
