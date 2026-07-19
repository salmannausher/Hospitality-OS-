# Prompt Library — Implementation Prompts

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Depends on:** [AI Engine Specification §3](10-ai-engine-specification.md) · [Engineering Conventions §2](12-engineering-conventions.md) · [Sprint Backlog](14-sprint-backlog.md)

Six ready-to-paste prompts for a Claude Code session — the content of each is already decided (in [AI Engine §3](10-ai-engine-specification.md)); these just turn that decision into an actual implementation task, self-contained enough that a fresh session with this repo's `docs/` folder can execute one without re-deriving anything. **Run Prompt 0 first** — the five module prompts assume `base.md` and `registry.ts` already exist. Prompts 1–5 can then run in any order.

---

## Prompt 0 — Scaffold the Prompt Library

```
Create the packages/prompts library described in AI Engine Specification §3
(docs/10-ai-engine-specification.md). Set up:

packages/prompts/
├── base.md
├── classifier.md
├── entity-extraction.md
├── modules/            (empty for now — populated by separate tasks)
└── registry.ts

1. base.md — copy the system prompt template verbatim from AI Behavior
   Specification §14 (docs/02-ai-behavior-specification.md), including all
   {{variable}} placeholders. Add one new placeholder, {{modules}}, inserted
   after the escalation/lead-capture rules and before "Retrieved context:" —
   this is where composed domain/persona modules get injected at runtime.

2. classifier.md — copy the classifier prompt verbatim from AI Engine §3.

3. entity-extraction.md — copy the entity-extraction prompt verbatim from
   AI Engine §3.

4. registry.ts — define and export:

   export interface PromptRegistryEntry {
     id: string;                 // e.g. "base", "classifier", "modules/wedding"
     version: string;            // e.g. "v1"
     filePath: string;           // relative path within packages/prompts
     active: boolean;            // only relevant for versioned entries with >1 version
     playbookCoverage: string[]; // Playbook scenario IDs that validate this prompt
     triggerCondition: string;   // human-readable — "always" for base/classifier/
                                  // entity-extraction, or the domain/persona condition
                                  // for a module
   }

   export const promptRegistry: PromptRegistryEntry[] = [
     { id: "base", version: "v1", filePath: "base.md", active: true,
       playbookCoverage: ["G-00", "G-11"], triggerCondition: "always" },
     { id: "classifier", version: "v1", filePath: "classifier.md", active: true,
       playbookCoverage: ["G-16", "G-17"], triggerCondition: "always" },
     { id: "entity-extraction", version: "v1", filePath: "entity-extraction.md",
       active: true, playbookCoverage: [], triggerCondition: "ingestion-time only" },
   ];
   // Module entries are added by the five separate module tasks, not here.

Do not invent content for any of the three files above — every word comes from
AI Engine §3 or ABS §14. If anything in this repo's docs/ folder appears to
have changed since those sections were written, stop and flag the discrepancy
rather than guessing which version is current.
```

## Prompt 1 — `general.md`

```
Add the "general" module to packages/prompts (scaffolded by a prior task —
see AI Engine Specification §3, docs/10-ai-engine-specification.md, if
packages/prompts/registry.ts doesn't exist yet, stop and run that task first).

1. Create packages/prompts/modules/general.md with this exact content:

No specific occasion or traveler type has been detected yet. Keep tone warm and
unhurried per the configured tone preset. Answer what was asked; don't guess at an
occasion or persona that hasn't actually been signaled. If the guest's next message
reveals one, a more specific module takes over automatically — there's nothing to
force here.

2. Add this entry to the promptRegistry array in packages/prompts/registry.ts:

   { id: "modules/general", version: "v1", filePath: "modules/general.md",
     active: true, playbookCoverage: ["G-00"],
     triggerCondition: "default — no domain or persona detected" }

3. Wire the selection logic: when the classifier's `domain` array is empty and
   `persona` is null, this is the only module composed onto base.md. Do not
   compose it alongside any other module — it's a fallback, not an addition.

4. Verify against Playbook scenario G-00 (docs/04-conversation-playbook.md) —
   the welcome/greeting case, where no domain or persona signal exists yet.
```

## Prompt 2 — `wedding.md`

```
Add the "wedding" module to packages/prompts (scaffolded by a prior task —
see AI Engine Specification §3, docs/10-ai-engine-specification.md, if
packages/prompts/registry.ts doesn't exist yet, stop and run that task first).

1. Create packages/prompts/modules/wedding.md with this exact content:

This guest is exploring the property for a wedding or large event. Slow down —
this is a high-stakes, emotional decision, not a routine booking. Ask one
clarifying question at a time (guest count, date, indoor/outdoor) rather than
presenting every package at once. Share venue capacity and package facts from the
knowledge base, but do not attempt to close the inquiry yourself — once guest
count, date, or budget specifics are on the table, route to a human wedding
coordinator per the escalation protocol's group/event threshold. Being helpful
here means guiding toward a real coordinator conversation, not maximizing what the
concierge itself can answer.

2. Add this entry to the promptRegistry array in packages/prompts/registry.ts:

   { id: "modules/wedding", version: "v1", filePath: "modules/wedding.md",
     active: true, playbookCoverage: ["G-09", "G-10"],
     triggerCondition: "domain includes 'events' OR persona is 'wedding_planner'" }

3. Wire the selection logic: compose this module onto base.md whenever the
   classifier's domain array includes "events" or persona is "wedding_planner" —
   additively alongside any other matched module (e.g. a family_traveler asking
   about a wedding gets both family-travel.md and wedding.md).

4. Verify against Playbook scenarios G-09 (wedding inquiry, escalation to
   coordinator) and G-10 (corporate/events adjacent case) in
   docs/04-conversation-playbook.md — confirm the concierge asks one
   clarifying question before recommending, and routes to a human once
   guest count/date/budget specifics appear, rather than trying to close
   the inquiry itself.
```

## Prompt 3 — `spa.md`

```
Add the "spa" module to packages/prompts (scaffolded by a prior task —
see AI Engine Specification §3, docs/10-ai-engine-specification.md, if
packages/prompts/registry.ts doesn't exist yet, stop and run that task first).

1. Create packages/prompts/modules/spa.md with this exact content:

Recommend treatments only from indexed spa content — never invent a treatment,
duration, or price. If a guest asks about suitability for a medical condition,
pregnancy, or an allergy, do not offer reassurance yourself — state you'll confirm
with spa staff. Pair a treatment recommendation with practical booking information
(duration, facility) rather than just a name.

2. Add this entry to the promptRegistry array in packages/prompts/registry.ts:

   { id: "modules/spa", version: "v1", filePath: "modules/spa.md",
     active: true, playbookCoverage: ["G-05", "29", "30"],
     triggerCondition: "domain includes 'spa'" }

   Note on coverage: G-05 tests the relationship-bundle path (an anniversary
   recommendation that happens to include a spa treatment), not this module's
   own grounding/medical-deferral rules in isolation. Scenarios 29 and 30 in the
   Playbook's compact table (docs/04-conversation-playbook.md) are the more
   direct tests — "how long is the treatment and what does it cost" (grounding)
   and "is a prenatal massage safe" (medical-deferral). Treat this module's
   dedicated coverage as thinner than wedding/family-travel's until real pilot
   transcripts add to it, per the Playbook's own stated preference for real
   failures over more hypothetical scenarios.

3. Wire the selection logic: compose this module onto base.md whenever the
   classifier's domain array includes "spa" — additively alongside any other
   matched module.

4. Verify against Playbook scenarios G-05, 29, and 30 — confirm treatments are
   never invented, and medical/pregnancy/allergy questions are deferred to
   staff rather than answered with reassurance.
```

## Prompt 4 — `family-travel.md`

```
Add the "family-travel" module to packages/prompts (scaffolded by a prior task —
see AI Engine Specification §3, docs/10-ai-engine-specification.md, if
packages/prompts/registry.ts doesn't exist yet, stop and run that task first).

1. Create packages/prompts/modules/family-travel.md with this exact content:

Lead with practical logistics — room capacity, connecting rooms, kids' club hours
and age range, pool access — before warmth. If the guest's message under-specifies
party composition (e.g. "we have two children" with no ages or room need given),
ask one clarifying question before recommending anything. Once specifics are
known, answer with the complete relevant bundle in one turn — capacity, extra
beds, kids' club, pool, a family-dining suggestion — rather than making the guest
ask about each one separately.

2. Add this entry to the promptRegistry array in packages/prompts/registry.ts:

   { id: "modules/family-travel", version: "v1", filePath: "modules/family-travel.md",
     active: true, playbookCoverage: ["G-16"],
     triggerCondition: "persona is 'family_traveler'" }

3. Wire the selection logic: compose this module onto base.md whenever the
   classifier's persona is "family_traveler" — additively alongside any other
   matched domain module (e.g. spa.md if the same guest also asks about spa).

4. Verify against Playbook scenario G-16 (docs/04-conversation-playbook.md) —
   this is the two-turn scenario that tests both halves of this module: the
   clarifying question on an underspecified message, and the complete bundle
   answer once specifics are known. Both halves must pass, not just one.
```

## Prompt 5 — `business-travel.md`

```
Add the "business-travel" module to packages/prompts (scaffolded by a prior task —
see AI Engine Specification §3, docs/10-ai-engine-specification.md, if
packages/prompts/registry.ts doesn't exist yet, stop and run that task first).

1. Create packages/prompts/modules/business-travel.md with this exact content:

Be efficient. Minimize flourish — answer directly, and proactively surface Wi-Fi
reliability, meeting room availability, and express checkout without being asked
twice. Treat any meeting- or event-space inquiry as B2B: capacity, AV, and
catering minimums first, then a proposal follow-up, rather than a conversational
back-and-forth about preferences.

2. Add this entry to the promptRegistry array in packages/prompts/registry.ts:

   { id: "modules/business-travel", version: "v1",
     filePath: "modules/business-travel.md", active: true,
     playbookCoverage: ["G-10"],
     triggerCondition: "persona is 'business_traveler'" }

   Note on coverage: G-10 (corporate meetings) is the closest existing test,
   but it's an events-domain scenario more than a dedicated "efficient tone,
   Wi-Fi/checkout" test of the business_traveler persona itself. Flag this as
   thin coverage — a good candidate for the first hand-written addition to the
   Playbook's backlog cells (Playbook §3) rather than assuming it's adequately
   tested by G-10 alone.

3. Wire the selection logic: compose this module onto base.md whenever the
   classifier's persona is "business_traveler" — additively alongside any
   other matched domain module.

4. Verify against Playbook scenario G-10, and treat a genuinely dedicated
   business-traveler scenario (a guest asking about Wi-Fi/checkout with no
   events angle at all) as a gap to fill before this module ships to a real
   pilot hotel.
```

---

**After all six run:** `packages/prompts` should contain `base.md`, `classifier.md`, `entity-extraction.md`, `registry.ts`, and five files under `modules/` — matching the structure in [AI Engine §3](10-ai-engine-specification.md) exactly, with every entry's Playbook coverage either real or honestly flagged as thin.
