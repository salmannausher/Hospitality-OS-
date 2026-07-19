// Prompt Library registry — docs/10-ai-engine-specification.md §3.
// Maps every prompt/module to a version and the Playbook scenario IDs that
// validate it. A change to any prompt is tested against its registered
// coverage before being considered the active version — the same draft →
// test → activate flow DB Design §4 already defines for per-hotel
// PromptOverride rows, applied here to the base prompts everyone inherits.

export interface PromptRegistryEntry {
  id: string; // e.g. "base", "classifier", "modules/wedding"
  version: string; // e.g. "v1"
  filePath: string; // relative path within packages/prompts
  active: boolean; // only relevant for versioned entries with >1 version
  playbookCoverage: string[]; // Playbook scenario IDs that validate this prompt
  triggerCondition: string; // "always" for base/classifier/entity-extraction,
  // or the domain/persona condition for a module
}

export const promptRegistry: PromptRegistryEntry[] = [
  {
    id: "base",
    version: "v1",
    filePath: "base.md",
    active: true,
    playbookCoverage: ["G-00", "G-11"],
    triggerCondition: "always",
  },
  {
    id: "classifier",
    version: "v1",
    filePath: "classifier.md",
    active: true,
    playbookCoverage: ["G-16", "G-17"],
    triggerCondition: "always",
  },
  {
    id: "entity-extraction",
    version: "v1",
    filePath: "entity-extraction.md",
    active: true,
    playbookCoverage: [],
    triggerCondition: "ingestion-time only",
  },
  {
    id: "modules/general",
    version: "v1",
    filePath: "modules/general.md",
    active: true,
    playbookCoverage: ["G-00"],
    triggerCondition: "default — no domain or persona detected",
  },
  {
    id: "modules/wedding",
    version: "v1",
    filePath: "modules/wedding.md",
    active: true,
    playbookCoverage: ["G-09", "G-10"],
    triggerCondition: "domain includes 'events' OR persona is 'wedding_planner'",
  },
  {
    id: "modules/spa",
    version: "v1",
    filePath: "modules/spa.md",
    active: true,
    // G-05 tests the relationship-bundle path (spa is incidental to it), not this
    // module's own grounding/medical-deferral rules in isolation. 29/30 (Playbook
    // compact table) are the more direct tests. Coverage is thinner than
    // wedding/family-travel's — a good candidate for real pilot transcripts.
    playbookCoverage: ["G-05", "29", "30"],
    triggerCondition: "domain includes 'spa'",
  },
  {
    id: "modules/family-travel",
    version: "v1",
    filePath: "modules/family-travel.md",
    active: true,
    playbookCoverage: ["G-16"],
    triggerCondition: "persona is 'family_traveler'",
  },
  {
    id: "modules/business-travel",
    version: "v1",
    filePath: "modules/business-travel.md",
    active: true,
    // G-10 is an events-domain scenario, not a dedicated test of the efficient/
    // Wi-Fi/checkout persona behavior itself. Flagged as thin coverage — add a
    // genuinely dedicated business-traveler scenario before this ships to a
    // real pilot hotel (docs/15-prompt-library-implementation-prompts.md, Prompt 5).
    playbookCoverage: ["G-10"],
    triggerCondition: "persona is 'business_traveler'",
  },
];
