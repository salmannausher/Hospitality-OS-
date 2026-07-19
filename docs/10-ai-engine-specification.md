# AI Engine Specification

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [AI Behavior Specification](02-ai-behavior-specification.md) · [Information Architecture](03-information-architecture.md) · [System Architecture](06-system-architecture.md) · [API Specification](09-api-specification.md)

Every prior document *named* a model call — a classifier, a rerank step, "response validation." None of them said which model, what it costs, how long it takes, or what happens when it fails. This document is the inventory: every LLM and embedding call in the system, one section each, so nobody discovers at implementation time that "the pipeline" is actually seven undocumented API calls with no fallback plan.

---

## 1. The Full Call Inventory

Per guest message, in order. This table is the answer to "how many model calls does one turn actually make" — a question nobody had answered yet, and the one that determines both latency (§6) and unit cost (§7).

| # | Step | Model call? | Model tier | Latency budget |
|---|---|---|---|---|
| 1 | Journey-state + intent classification | Yes — 1 call | Small/fast | ~200ms |
| 2 | Query rewrite | Folded into #1 (see §2) | — | — |
| 3 | Embedding the guest's query | Yes — 1 call | Voyage AI embedding | ~100ms |
| 4 | Retrieval (vector search + domain filter + entity join) | No — plain SQL | — | ~50ms |
| 5 | Reranking | No — deterministic scoring, not a model call (see §4) | — | ~5ms |
| 6 | Response generation | Yes — 1 call, streamed | Primary (Claude) | first token ~700ms–1s |
| 7 | Response validation / hallucination check | **No separate call** — see §5 | — | — |

**Three model calls per guest message**, not seven. Two of the things every prior doc implied were separate LLM calls (rerank, validation) are deliberately *not* model calls — that's the single most consequential decision in this document, and it's made explicitly below rather than left to whoever implements it first.

**Ingestion-side calls** (async, not latency-sensitive, batched):

| Step | Model call? | Notes |
|---|---|---|
| Entity extraction from parsed documents | Yes — 1 call per document/section | Structured output, populates the nine entity tables ([IA §3](03-information-architecture.md)) |
| Domain tagging | Folded into entity extraction — one call returns both | Avoids a second pass over the same content |
| Chunk embedding | Yes — 1 call per chunk (batched) | Voyage AI, same model as query-time embedding (§1 step 3) — embedding spaces must match |

## 2. Journey-State + Intent + Query Rewrite — One Call, Not Three

The ABS and IA each named these as conceptually distinct steps: journey-state ([ABS §16](02-ai-behavior-specification.md)), topical intent ([ABS §17](02-ai-behavior-specification.md)), query rewrite ([ABS §11](02-ai-behavior-specification.md)). Conceptually distinct doesn't mean three API calls.

**Decision: one structured-output call**, given the message plus recent conversation history, returns:

```json
{
  "journeyState": "planning",
  "domain": ["dining", "spa"],
  "persona": "luxury_traveler",
  "rewrittenQuery": "restaurant recommendations for anniversary dinner",
  "detectedSignals": { "occasion": "anniversary", "leadCaptureWorthy": true }
}
```

**Why one call is safe, not a corner cut:** these three classifications share the same input (the message + history) and the same output shape (a small structured object) — there's no accuracy reason to separate them, only an organizational one, and the organizational distinction already lives in the ABS/IA docs, not in the runtime. Splitting them would triple this step's latency and cost for zero behavioral benefit.

**Model tier:** small/fast (e.g., Haiku-class or equivalent via the AI Gateway) — this is a classification task, not a generation task; using the primary model here would be paying generation-tier cost for a job that doesn't need it.

**Fallback:** timeout or malformed output → default to `journeyState: "information"`, `domain: []`, `rewrittenQuery: <original message>`. This is a deliberately safe default — Information state is the most conservative posture (answer plainly, no recommendation, no lead ask), never Service Recovery by omission, and never a false Planning/Booking Intent that triggers an unwanted lead prompt.

**The actual prompt** — this is the piece that was previously missing: every prior document described what this call should output, none specified the instructions that produce it. Lives at `packages/prompts/classifier.md` ([Engineering Conventions §2](12-engineering-conventions.md)):

```
You classify a single guest message for a luxury hotel digital concierge. Given the
guest's message and recent conversation history, output a structured classification.
Do not generate a reply to the guest — classification only.

Determine:

1. journeyState — exactly one of: information | planning | booking_intent | service_recovery
   - service_recovery: ANY complaint, negative sentiment about a current or past stay,
     safety/medical/legal language, or an in-house guest issue (broken AC, noise, room
     problem). If in doubt between service_recovery and anything else, choose
     service_recovery — this classification overrides all downstream behavior, so a
     false negative here is far worse than a false positive.
   - booking_intent: guest is comparing specific options, naming dates, or asking for a
     recommendation with enough detail to act on (e.g. "which suite for four nights
     with two kids").
   - planning: guest is describing a trip, occasion, or need without asking to
     compare/decide yet (e.g. "we're visiting in October", "we're celebrating our
     anniversary").
   - information: a direct factual question with no planning/booking signal (e.g.
     "what time is breakfast").

2. domain — zero or more of: accommodation, booking, dining, spa, property,
   local_area, policies, events

3. persona — the single best-fit traveler type, or null if unclear:
   luxury_traveler | family_traveler | business_traveler | wedding_planner |
   event_organizer

4. rewrittenQuery — the guest's message rewritten as a self-contained retrieval
   query, resolving pronouns and context from history (e.g. "what about for kids"
   after a spa question becomes "spa treatments suitable for children")

5. detectedSignals — { occasion, leadCaptureWorthy } — leadCaptureWorthy is true
   only if the guest named specific dates, asked for a quote or itinerary, described
   an occasion, or is actively comparing options — never true from a single
   unadorned question.

Output only the JSON object matching the schema. Never explain your reasoning.
```

This prompt's instructions are a direct transcription of [ABS §16](02-ai-behavior-specification.md)'s journey-state table and [ABS §12](02-ai-behavior-specification.md)'s persona definitions — nothing new is being decided here, it's the first time those definitions have been turned into text a model actually receives.

## 3. The Prompt Library

There are three prompts in this system, not one — the response-generation template ([ABS §14](02-ai-behavior-specification.md)), the classifier above, and an ingestion-time entity-extraction prompt (below). All three live in `packages/prompts` as a versioned library, not scattered inline in application code, for the same reason the [Playbook](04-conversation-playbook.md) exists: a prompt that can't be inspected and tested in isolation is a prompt that drifts silently.

**Structure — composable modules, not independent prompts per scenario.** The tempting design is a fully separate system prompt per persona/domain (a "Wedding Concierge," a "Spa Concierge," a "Complaint Handler"), with something routing between them. That was considered and rejected: it would require a routing decision — a fourth model call, reopening the "three calls, not seven" result in §1 — and it would fork every universal rule (grounding, the escalation override, forbidden behaviors) across N independent copies that must be kept in sync by hand. Worse, it risks the one guarantee this system cannot afford to lose: Service Recovery overriding everything ([ABS §16](02-ai-behavior-specification.md)) only works if it can't be *missed* by a router — and a domain/persona-based router has no reliable way to catch a complaint that surfaces mid-wedding-inquiry.

Instead: **one base template, always active, with small composable modules injected based on the classifier's output** (`domain` and `persona` above) — no new model call, no forked universal rules.

```
packages/prompts/
├── base.md              # ABS §14's template — universal rules, escalation
│                           protocol, lead-capture logic. Always present,
│                           unconditionally, in every generated system prompt.
├── classifier.md          # the prompt above
├── entity-extraction.md   # ingestion-side, below
├── modules/
│   ├── general.md          # default — no specific persona/domain detected
│   ├── wedding.md           # domain: events, or persona: wedding_planner
│   ├── spa.md               # domain: spa
│   ├── family-travel.md     # persona: family_traveler
│   └── business-travel.md   # persona: business_traveler
└── registry.ts            # prompt id → version → Playbook scenario coverage
```

**Where "Complaint Handler," "Lead Capture," and "Booking Assistant" went** — these were on the original proposed module list, and deliberately did *not* become modules:

| Originally proposed | Where it actually lives |
|---|---|
| Complaint Handler | `base.md`'s escalation protocol ([ABS §7](02-ai-behavior-specification.md)) — always active, fires on `journeyState: service_recovery` regardless of domain. Never a module a router could fail to select. |
| Lead Capture | `base.md`'s lead-capture rules ([ABS §8](02-ai-behavior-specification.md)) — universal signal-driven behavior, applies in any domain. |
| Booking Assistant | Not a domain — it's the `booking_intent` journey state's posture ([ABS §16](02-ai-behavior-specification.md)), already handled by `base.md` reacting to the classifier's `journeyState` field. |

That leaves five real modules: one default and four that add domain/persona-specific emphasis on top of the universal base. All five, in full — each is deliberately short; a module adds emphasis, it doesn't restate the base rules.

**`general.md`** (default — no specific domain/persona detected):

```
No specific occasion or traveler type has been detected yet. Keep tone warm and
unhurried per the configured tone preset. Answer what was asked; don't guess at an
occasion or persona that hasn't actually been signaled. If the guest's next message
reveals one, a more specific module takes over automatically — there's nothing to
force here.
```

**`wedding.md`** (domain: `events`, or persona: `wedding_planner` — [ABS §12](02-ai-behavior-specification.md), tested against [Playbook G-09](04-conversation-playbook.md)):

```
This guest is exploring the property for a wedding or large event. Slow down —
this is a high-stakes, emotional decision, not a routine booking. Ask one
clarifying question at a time (guest count, date, indoor/outdoor) rather than
presenting every package at once. Share venue capacity and package facts from the
knowledge base, but do not attempt to close the inquiry yourself — once guest
count, date, or budget specifics are on the table, route to a human wedding
coordinator per the escalation protocol's group/event threshold. Being helpful
here means guiding toward a real coordinator conversation, not maximizing what the
concierge itself can answer.
```

**`spa.md`** (domain: `spa`):

```
Recommend treatments only from indexed spa content — never invent a treatment,
duration, or price. If a guest asks about suitability for a medical condition,
pregnancy, or an allergy, do not offer reassurance yourself — state you'll confirm
with spa staff. Pair a treatment recommendation with practical booking information
(duration, facility) rather than just a name.
```

**`family-travel.md`** (persona: `family_traveler` — [ABS §12](02-ai-behavior-specification.md), tested against [Playbook G-16](04-conversation-playbook.md)):

```
Lead with practical logistics — room capacity, connecting rooms, kids' club hours
and age range, pool access — before warmth. If the guest's message under-specifies
party composition (e.g. "we have two children" with no ages or room need given),
ask one clarifying question before recommending anything. Once specifics are
known, answer with the complete relevant bundle in one turn — capacity, extra
beds, kids' club, pool, a family-dining suggestion — rather than making the guest
ask about each one separately.
```

**`business-travel.md`** (persona: `business_traveler` — [ABS §12](02-ai-behavior-specification.md)):

```
Be efficient. Minimize flourish — answer directly, and proactively surface Wi-Fi
reliability, meeting room availability, and express checkout without being asked
twice. Treat any meeting- or event-space inquiry as B2B: capacity, AV, and
catering minimums first, then a proposal follow-up, rather than a conversational
back-and-forth about preferences.
```

Modules compose additively (a family traveler asking about spa gets both `family-travel.md` and `spa.md` concatenated into `base.md`) — they only ever add emphasis, never contradict the base, so there's no precedence rule to get wrong. When `journeyState` is `service_recovery`, **no domain/persona module is injected at all** — only `base.md`'s escalation protocol applies, which is the concrete mechanism behind the guarantee above.

**Versioning and test coverage** — `registry.ts` maps every prompt/module to a version and the specific [Playbook](04-conversation-playbook.md) scenario IDs that validate it (e.g. `wedding.md@v1 → G-09, G-10, 47`). A change to any prompt is tested against its registered coverage before being considered the active version — the same draft → test → activate flow [DB §4](07-database-design.md) already defines for per-hotel `PromptOverride` rows, applied here to the base prompts everyone inherits.

**Entity extraction** (ingestion-side, [IA §5](03-information-architecture.md) / §1 above), `packages/prompts/entity-extraction.md` — the third prompt that had never been drafted:

```
You extract structured hotel data from a parsed document for indexing. Given a chunk
of source text, extract every structured entity it contains, typed as one of:
RoomType, Package, Restaurant, SpaTreatment, Amenity, Policy, LocalRecommendation,
EventSpace, Experience, PropertyProfile.

For each entity found, output its type and only the fields defined for that type.
Leave a field null rather than guessing — a missing field triggers a Needs Review
admin prompt; a guessed field risks the concierge stating something false to a guest
later. Do not invent an entity that isn't clearly described in the source text.

Also assign one or more domain tags to the text as a whole, from: accommodation,
booking, dining, spa, property, local_area, policies, events.

If the text describes a policy without a clear structured format (e.g. an informal
note about pet policy), still extract it as a Policy entity with topic and ruleText
— this is exactly the content most likely to otherwise be missed and fall back to a
guest-facing "I don't have confirmed information" response.

Output only the JSON array of extracted entities plus the domain tags.
```

## 4. Reranking Is Not a Model Call

[IA §7](03-information-architecture.md) listed "rerank top-k candidates" without specifying method. The tempting default is a cross-encoder reranking model — a second, more expensive pass over retrieved chunks. **Decision: deterministic weighted scoring instead:**

```
score = (0.65 × vector_similarity) + (0.20 × priority_weight) + (0.15 × recency_weight)
```

`priority_weight` comes directly from the `Chunk.priority` field ([DB §5](07-database-design.md) — HIGH/NORMAL/LOW, already set at ingestion); `recency_weight` decays from `lastVerifiedAt`. No model call, no added latency, no added cost — and it's more auditable than a reranking model's opaque score, which matters when an admin asks "why did it pick that chunk." This is revisited only if pilot data shows deterministic reranking measurably underperforms a learned reranker — a real possibility at scale, not assumed to be fine forever, just not paid for on guesswork now.

## 5. Response Validation Is Confidence-Gating, Not a Second Opinion

PRD §12 listed "response validation" and "hallucination prevention" as features. The naive implementation is a second LLM call that checks the first one's answer against the retrieved context after generation — doubling cost and latency on every single message to catch a failure mode the pipeline should prevent earlier instead.

**Decision: prevention before generation, not inspection after it.**

- The confidence band ([ABS §5](02-ai-behavior-specification.md)) is computed from retrieval signals (§1, step 4/5's scores) **before** the generation call runs. A Low-Confidence result routes to the honest "I don't have confirmed information" pattern ([ABS §6](02-ai-behavior-specification.md)) *instead of* calling the generation model at all on that turn — this is simultaneously cheaper (no wasted generation call) and safer (no model output to have hallucinated in the first place).
- The system prompt's grounding instructions ([ABS §14](02-ai-behavior-specification.md): "do not invent prices, availability, room counts, or policies") are the enforcement mechanism for High/Medium-confidence turns, not a downstream check.
- Real hallucinations that slip through anyway are caught the way everything else in this system improves: sampled conversations scored against the [QA Rubric](02-ai-behavior-specification.md), failures converted into new [Playbook](04-conversation-playbook.md) scenarios — an async, aggregate correction loop, not a per-message tax.

**Confidence formula, made concrete** (inputs were named in ABS §5/IA §7, never combined until now):

```
confidence = (0.5 × top_chunk_similarity) + (0.3 × chunk_agreement) + (0.2 × classifier_certainty)

High:   confidence ≥ 0.75
Medium: 0.5 ≤ confidence < 0.75
Low:    confidence < 0.5
```

`chunk_agreement` = how tightly the top-k retrieved chunks cluster (high agreement = multiple chunks corroborate the same fact; low agreement = the single top hit is an outlier, which should reduce trust even if its raw similarity score looks fine). `classifier_certainty` comes from step 1's structured output. Thresholds are the same "ship conservative, tune from pilot data" default already stated in the ABS — false confidence costs more than an extra handoff.

## 6. Latency Budget vs. the <2s NFR

[PRD §17](01-PRD-ai-concierge.md) requires chat response to *start* under 2 seconds. Walking the critical path:

```
ack event (protocol, §2.1 of the API spec)          ~instant  ← satisfies the NFR immediately
  │
classification call                                   ~200ms
embedding + retrieval + rerank                         ~150ms
generation call — time to FIRST streamed token         ~700ms–1s
                                                        ─────────
Time to first visible answer token                     ~1.0–1.4s
```

The `ack` event means the NFR is satisfied structurally, not by racing the model — the guest sees acknowledgment well under 2s regardless of generation latency, and the classification+retrieval path (~350ms) leaves comfortable headroom before the first generation token even needs to arrive. This is also where [Option D's](08-ui-design-system-option-d.md) "Breath" tempo token gets its budget from, if that design layer is adopted: the 700ms breath is real model latency wearing a costume, not added delay on top of a fast response.

## 7. Unit Cost — Validating the Earlier Cost Estimate

Rough per-message token accounting, at the "few thousand chunks per hotel" scale this product actually operates at (per [DB Design](07-database-design.md)'s pgvector reasoning):

| Call | Approx. tokens | Model tier |
|---|---|---|
| Classification | ~300 in / ~80 out | Small/fast |
| Query embedding | ~30 tokens | Embedding |
| Generation | ~1,500 in (system prompt + retrieved context + history) / ~150 out | Primary |

At a small number of guest turns per day for one pilot hotel, this comfortably sits inside the **~$10–20/month AI cost** already estimated in the earlier budget discussion — that estimate holds because the call count is 3, not 7, and because classification (the highest-frequency call) runs on the cheapest tier. If the call inventory had actually been 7 calls including a cross-encoder rerank and a validation pass, that estimate would have been optimistic by roughly 2–3x. Documenting the call count is what makes the cost estimate a fact instead of a guess.

**Embeddings specifically: verified, not assumed, to be ~$0 at pilot scale.** Voyage AI provides 200 million free tokens per account on the `voyage-4` family ([voyageai.com pricing](https://docs.voyageai.com/docs/pricing), checked directly rather than carried over from an earlier, provider-mismatched estimate) — one pilot hotel's ingestion (a few hundred to low thousands of chunks) plus one query embedding per guest message is nowhere near that ceiling. Paid rate past the free tier is $0.02–$0.12/M tokens depending on model tier. This closes a real gap: the original "$10–20/month" figure was carried over from a cost analysis that assumed OpenAI's embedding pricing, before the deliberate switch to Voyage ([Engineering Conventions §10](12-engineering-conventions.md)) — it happens to still hold, but that's now a checked fact, not an inherited assumption.

## 8. Failure Modes & Fallbacks, Per Call

| Call | Failure | Fallback |
|---|---|---|
| Classification (§2) | Timeout / malformed JSON | Safe default (§2) — never silently retries mid-conversation, since a retry here would blow the latency budget |
| Query embedding | Provider error | Fall back to the *unrewritten* guest message for lexical/domain-tag-only retrieval this turn — degraded retrieval, not a broken turn |
| Generation | Provider error / timeout | `error` SSE event ([API §2.1](09-api-specification.md)) → widget shows the graceful fallback and offers handoff ([UX §13](05-user-experience-flows.md)) — never a silent hang |
| Ingestion-side extraction | Malformed structured output | Document status → `NEEDS_REVIEW` ([DB §5](07-database-design.md)), same path as a missing required field — one failure-handling mechanism, not two |

All model calls route through the AI Gateway ([Architecture §7](06-system-architecture.md)), so provider fallback (if Claude is unavailable, route to a configured secondary) is a gateway-level concern, not application logic duplicated at each of these four call sites.

## 9. What's Deliberately Not Built Into V1

- **No agentic tool-calling loop.** Every call above is a single request/response — no model call decides to invoke another model call. The pipeline is a fixed sequence (§1), not an agent making its own routing decisions. This is a scope decision, not an oversight: a fixed pipeline is fully testable against the [Playbook](04-conversation-playbook.md) in a way a self-directing agent loop isn't yet, at this stage of the product.
- **No fine-tuning.** Behavior is entirely prompt- and retrieval-driven ([ABS §14](02-ai-behavior-specification.md)), which is also why the [Playbook](04-conversation-playbook.md)/QA loop is the improvement mechanism rather than a training pipeline.
- **No learned reranker, no separate validation model** — both addressed above, and both revisited only with real pilot evidence, not preemptively.
- **No prompt router.** A fully independent system prompt per persona/domain (a "Wedding Concierge," a "Complaint Handler"), selected by a routing step, was considered and rejected in §3 — it's a second instance of the same "no model call decides to invoke another" boundary above, and it risked the Service Recovery override being missable by whatever did the routing.

---

**Next:** [Development Plan](11-development-plan.md) — build sequence, testing approach, and environment setup. See also the [documentation index](README.md).
