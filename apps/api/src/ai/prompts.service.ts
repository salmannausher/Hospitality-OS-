import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Domain, Persona } from '@hospitality/types';

/**
 * Loads and composes the versioned prompt library (packages/prompts, AI Engine
 * §3). The .md files are runtime assets read from the filesystem, not module
 * imports — the prompts package ships raw source, and reading the files keeps
 * this working regardless of how the api is bundled.
 *
 * Module selection (Sprint 3, docs/15-prompt-library-implementation-prompts.md
 * Prompts 1–5's own "wire the selection logic" step): `general.md` is a
 * fallback, never composed alongside another module; every other module is
 * additive — a family_traveler asking about spa gets both family-travel.md
 * and spa.md in the same system prompt, not just one.
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
   * variables filled, and the domain/persona modules the classifier's output
   * selects (registry.ts's `triggerCondition` per module).
   */
  assembleSystemPrompt(input: {
    conciergeName: string;
    hotelName: string;
    formalityLevel: string;
    brandAdjectives: string;
    domain: Domain[];
    persona: Persona | null;
    ragContext: string;
    messageHistory: string;
  }): string {
    const base = this.read('base.md');
    const modules = this.selectModules(input.domain, input.persona);
    return base
      .replaceAll('{{concierge_name}}', input.conciergeName)
      .replaceAll('{{hotel_name}}', input.hotelName)
      .replaceAll('{{formality_level}}', input.formalityLevel)
      .replaceAll('{{brand_adjectives}}', input.brandAdjectives)
      .replaceAll('{{modules}}', modules)
      .replaceAll('{{rag_context}}', input.ragContext)
      .replaceAll('{{message_history}}', input.messageHistory);
  }

  /** registry.ts's `triggerCondition` per module, made real:
   * - `modules/wedding` — domain includes "events" OR persona is "wedding_planner"
   * - `modules/spa` — domain includes "spa"
   * - `modules/family-travel` — persona is "family_traveler"
   * - `modules/business-travel` — persona is "business_traveler"
   * - `modules/general` — fallback ONLY when nothing else matched, never
   *   alongside another module (Prompt 1 step 3: "it's a fallback, not an
   *   addition").
   */
  private selectModules(domain: Domain[], persona: Persona | null): string {
    const modules: string[] = [];
    if (domain.includes('events') || persona === 'wedding_planner') {
      modules.push(this.read('modules/wedding.md'));
    }
    if (domain.includes('spa')) {
      modules.push(this.read('modules/spa.md'));
    }
    if (persona === 'family_traveler') {
      modules.push(this.read('modules/family-travel.md'));
    }
    if (persona === 'business_traveler') {
      modules.push(this.read('modules/business-travel.md'));
    }
    if (modules.length === 0) {
      return this.read('modules/general.md').trim();
    }
    return modules.map((m) => m.trim()).join('\n\n');
  }
}
