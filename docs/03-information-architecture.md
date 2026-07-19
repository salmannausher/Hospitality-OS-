# Information Architecture

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [AI Behavior Specification](02-ai-behavior-specification.md)

This document defines how a hotel's knowledge — PDFs, policies, menus, brochures — becomes something the concierge can retrieve accurately at answer time. Every rule here exists to make [ABS §4 (Knowledge Grounding)](02-ai-behavior-specification.md) and [ABS §5 (Confidence Scoring)](02-ai-behavior-specification.md) actually possible in practice. A behavior spec that says "never invent information" is only as good as the retrieval system behind it — this is that system.

---

## 1. Purpose

Retrieval quality is the ceiling on everything else. If the knowledge base is poorly structured, no amount of prompt engineering in the ABS fixes it — the concierge will either hallucinate or over-escalate. This doc defines:

- How content is organized (domains, entities)
- How it's chunked and embedded
- How multi-tenancy stays isolated
- How retrieval maps back to the confidence bands in [ABS §5](02-ai-behavior-specification.md)
- How staleness and conflicting content are handled

## 2. Knowledge Domains

Every piece of content is tagged with one or more domains from the taxonomy already defined in [ABS §17](02-ai-behavior-specification.md), reproduced here as the IA's primary organizing axis:

`accommodation` · `booking` · `dining` · `spa` · `property` · `local_area` · `policies` · `events`

Domain tags drive two things downstream: **retrieval filtering** (§6) and **knowledge base UI grouping** ([PRD §11](01-PRD-ai-concierge.md)). A document can carry more than one tag (a wedding brochure is `events` + `dining` + `accommodation`), but every chunk produced from it inherits the parent document's tags plus any chunk-level override.

**`property` explicitly includes brand content, not just amenities** — about/brand story, location, contact, gallery, and awards content lives here too. Guests genuinely ask "tell me about the hotel" or "what awards have you won," and that content needs a home in the taxonomy rather than falling through the cracks between domains.

**FAQs are decomposed by domain, not kept as one page.** A hotel's FAQ document gets split at ingestion (§5) so each question-answer pair inherits the domain tag of its topic (`spa`, `policies`, `dining`, etc.) rather than living as one undifferentiated `faq` blob — a flat FAQ page is exactly the kind of source that produces poor retrieval, since "what's your cancellation policy" and "do you have a kids' club" end up equally (ir)relevant to any query.

## 3. Entity Model

Beneath the domain taxonomy, content resolves to a small set of structured entities — these become first-class objects in the database, not just free text, because several product features (Recommendation Engine, Booking CTA) need to query them directly rather than re-parse prose at answer time.

| Entity | Key fields | Example source |
|---|---|---|
| `Room Type` | name, view, capacity, bed config, accessibility features, base rate range | Room description PDF |
| `Package` | name, included items, valid dates, price range, linked room types | Package brochure |
| `Restaurant` | name, cuisine, hours, dress code, dietary tags, reservation policy | Menu PDF |
| `Spa Treatment` | name, duration, price, facility | Spa menu |
| `Amenity` | name, hours, location, access rules | Property fact sheet |
| `Policy` | topic (pets/smoking/cancellation/etc.), rule text, exceptions | Policy document |
| `Local Recommendation` | name, category, distance, hotel's curation note | Local guide doc |
| `Event Space` | name, capacity, layout options, AV, catering minimums | Events/wedding brochure |
| `Experience / Activity` | name, category (on-site/off-site), duration, price, booking lead time, age/skill restrictions | Activities brochure (golf, tennis, kids' club sessions, tours, airport transfer, yacht charter) |
| `Property Profile` | brand story, history, location, contact details, gallery refs, awards | About/brand page (singleton per hotel, not a list) |

`Experience / Activity` is kept distinct from `Amenity` (§3 table above) because activities are typically bookable, time-boxed, and priced, while amenities (pool, gym, Wi-Fi) are standing facilities with access rules rather than a booking flow — the Recommendation Engine and Booking CTA ([PRD FR-005/FR-006](01-PRD-ai-concierge.md)) need to treat them differently.

**Why this matters:** free-text RAG alone is sufficient for "what time does the spa close," but the Recommendation Engine ([PRD FR-005](01-PRD-ai-concierge.md)) needs to *filter* — "ocean-view suites for 4 nights, under $X" is a structured query, not a similarity search. Structured entities are extracted from uploaded documents at ingestion time (§5) and stored alongside the raw chunks; retrieval can hit either path depending on the query shape (§6).

These entities are also the nodes that the relationship layer (§12) connects — an entity list alone tells the AI *what exists*; §12 is what lets it reason about what *goes together*.

## 4. Source Content Types

| Type | MVP support | Handling |
|---|---|---|
| PDF | Yes | Text + layout extraction, table-aware parsing for menus/rate sheets |
| DOCX | Yes | Text extraction |
| Plain text / Markdown | Yes | Direct ingestion |
| Web pages (URL sync) | Yes | Scheduled re-crawl, diffed against last-indexed version |
| Images (menus-as-photos, floor plans) | Future (V2) | OCR pipeline |
| Video (property tour transcripts) | Future (V3) | Transcript extraction only, not visual understanding |

## 5. Ingestion Pipeline

```
Upload (Admin → Knowledge Base, PRD §11)
        │
        ▼
Format detection & parsing
        │
        ▼
Entity extraction (structured fields → §3 tables)
        │
        ▼
Chunking (§6)
        │
        ▼
Domain tagging (auto-suggested, admin-confirmed)
        │
        ▼
Embedding (Voyage AI embeddings)
        │
        ▼
Vector store write (pgvector, tenant-scoped — §8)
        │
        ▼
Validation pass (§9) → status: Indexed / Needs Review / Failed
```

Every step's status is visible in the Admin knowledge base UI ([PRD FR-003](01-PRD-ai-concierge.md)) — "chunk preview" and "embedding status" from the PRD map directly to this pipeline's intermediate states, not just a final pass/fail.

## 6. Chunking Strategy

- **Semantic chunking, not fixed-token windows.** Split on natural document boundaries first (headings, table rows, menu sections, FAQ entries), then only fall back to a token-length cap (~300–500 tokens) if a natural section runs long.
- **Tables stay atomic.** A rate table or menu table is never split mid-row — a chunk boundary inside a price table is one of the most common causes of a hallucinated or mismatched price.
- **Each chunk carries metadata**, not just text:

```
chunk {
  id
  hotel_id          // tenant scope — see §8
  document_id
  domain_tags[]      // from §2
  entity_refs[]       // links to §3 structured entities, if applicable
  source_type
  language
  last_verified_at    // drives staleness handling, §9
  priority            // high | normal | low — see below
  content
  embedding
}
```

`priority` is set automatically by domain (`policies`, `booking`, and pricing-bearing chunks default to `high`; gallery/brand-story copy defaults to `low`) and is admin-overridable. It does two concrete things: it tightens the staleness window in §9 (a `high` priority chunk gets re-flagged for review well before the default 90 days — a stale cancellation policy is a materially worse failure than a stale gallery caption), and it acts as a tie-breaker in reranking (§7) when two chunks are near-equal on similarity.

- **Overlap:** small overlap (~10–15%) between adjacent chunks from the same section, to avoid losing context at a boundary — but overlap is not a substitute for keeping tables atomic above.

## 7. Retrieval Pipeline

```
Guest message
        │
        ▼
Topical intent classification (ABS §17) + journey-state classification (ABS §16)
        │
        ▼
Query rewrite (resolve pronouns/context from session — ABS §11)
        │
        ▼
Hybrid search: vector similarity (pgvector) + domain-tag filter + entity-structured lookup where applicable
        │
        ▼
Rerank top-k candidates
        │
        ▼
Confidence signal = f(top similarity score, agreement across chunks, intent-classifier certainty)
        │
        ▼
Context assembly → injected into system prompt template (ABS §14)
```

The confidence signal produced here is exactly the input to [ABS §5's three bands](02-ai-behavior-specification.md) (High/Medium/Low) — retrieval and behavior are one pipeline, not two systems that happen to agree.

**Domain filtering is mandatory, not optional.** A guest asking about spa treatments should never retrieve wedding-package chunks purely on vector similarity — the domain tag (§2) constrains the search space before similarity ranking runs, which is what keeps answers from drifting into adjacent-but-wrong topics.

**Worked example.** "Can I book a couples massage after check-in?" narrows as: `spa` domain filter → `Spa Treatment` entity type → matches on "couples massage" → joined against the `Policy` entity for booking/availability rules. The system never runs an unfiltered search across the entire knowledge base — every query is scoped to a domain (and usually an entity type) before ranking happens, which is what keeps answers fast and accurate as a hotel's knowledge base grows into the hundreds of chunks.

## 8. Multi-Tenant Isolation

- Every chunk, embedding, and entity row is scoped by `hotel_id`. There is no cross-tenant retrieval path, ever — this is enforced at the query layer (row-level security), not just by application-level filtering, since a single missed filter would leak one hotel's rates or policies into another's conversations.
- Vector index queries always include the tenant filter as a hard predicate, not a post-filter on results — this is a performance requirement as much as a security one once the platform scales past a handful of hotels ([PRD §17](01-PRD-ai-concierge.md), scalable to 1,000+ hotels).
- Admin roles (Agency Admin vs. Hotel Admin, [PRD §16](01-PRD-ai-concierge.md)) determine which hotels' knowledge bases a given user can view or edit — an Agency Admin at Spherical can see across their portfolio; a Hotel Admin sees only their property.

## 9. Freshness, Conflict Resolution & Validation

- **Staleness:** every chunk carries `last_verified_at`. Content past a configurable age (default 90 days, tightened for `high` priority chunks — §6) is flagged for admin re-confirmation — not deleted, not silently trusted forever.
- **Conflicting content:** when two indexed chunks answer the same question differently (e.g., an old rate sheet not yet removed), this is exactly the case [ABS §4](02-ai-behavior-specification.md) already governs at answer time (surface to staff, answer from most-recently-indexed, offer to confirm). The IA's job is to make the conflict *detectable* — chunks with high mutual similarity but conflicting extracted entity values are flagged automatically at ingestion for admin review, rather than waiting to be discovered via a bad guest answer.
- **Validation pass (post-ingestion, pre-"live"):** checks for empty/near-empty chunks, failed table parses, missing required entity fields (e.g., a `Room Type` with no capacity), and broken source links (for URL-synced content). A document can be fully uploaded but sit in `Needs Review` until validation passes — it does not silently go live with gaps.
- **No answer is ever generated from a `Needs Review` or `Failed` chunk.** Only `Indexed` status content is eligible for retrieval.

## 10. Authoring Guidance for Hotels

To hit the PRD's "upload content in under 30 minutes" success criterion ([PRD §20](01-PRD-ai-concierge.md)), the knowledge base intake is optimized for content hotels *already have*, not new documentation work:

- Existing PDFs/brochures/menus can be dropped in as-is — the ingestion pipeline (§5) does the structuring work.
- A short guided checklist in Admin prompts for the highest-leverage structured entities if they're missing after auto-extraction (e.g., "we found your restaurant menu but no listed hours — add them here") rather than requiring a full manual data-entry pass.
- Policies (§3 `Policy` entity) are the one category worth a lightweight structured form up front, since they're high-stakes and often not written down in guest-facing documents at all (e.g., informal front-desk pet policy) — this is also where [ABS's Low-Confidence Response pattern](02-ai-behavior-specification.md) will fire most often if left ungrounded.

## 11. Multi-Language (Future)

MVP knowledge base is English-only ([PRD FR-012](01-PRD-ai-concierge.md)). The chunk schema already carries a `language` field (§6) so that V2+ can add parallel-language content per document without a schema migration — either hotel-provided translated source docs, or a translation step inserted between parsing and chunking.

## 12. Relationship Layer (Lightweight Hotel Knowledge Graph)

This is the difference between a system that *retrieves documents* and one that *understands the hotel*. Entities (§3) tell the AI what exists — a room, a restaurant, a spa treatment. On their own they answer "what time does the spa close." They don't answer "we're here for our anniversary, what should we do" — that requires knowing which entities *go together*, which is a relationship, not a retrieval result.

**Scope for V1 — deliberately lightweight, not a graph database.** Rather than building general-purpose graph infrastructure up front, V1 ships a simple `entity_relationships` table: curated edges between entities, each with a `relationship_type` and an optional `context_tag` (an occasion or guest-type it applies to).

```
entity_relationship {
  id
  hotel_id
  from_entity_id / from_entity_type
  to_entity_id / to_entity_type
  relationship_type   // e.g. "pairs_with", "suitable_for", "near"
  context_tag         // e.g. "anniversary", "family", "honeymoon"
  priority
}
```

**Example — occasion bundle** (`context_tag: anniversary`):

```
Anniversary
   ├─ pairs_with → Ocean Suite (Room Type)
   ├─ pairs_with → Rooftop Restaurant (Restaurant)
   └─ pairs_with → Couples Massage (Spa Treatment)
```

**Example — guest-type bundle** (`context_tag: family`):

```
Family
   ├─ suitable_for → Connecting Rooms (Room Type)
   └─ near → Kids' Club (Amenity, with hours)
```

**How this plugs into the rest of the system:**

- **Recommendation Engine** ([PRD FR-005](01-PRD-ai-concierge.md)) queries this table directly once a `context_tag` is detected, instead of relying on vector similarity to accidentally surface a coherent bundle. This is what makes the ABS's Planning journey state ([ABS §16](02-ai-behavior-specification.md)) — "we're celebrating our anniversary" → one well-chosen, *coherent* recommendation — reliable rather than a lucky similarity match.
- **Authoring is admin-curated at V1**, not auto-inferred: a hotel's marketing/reservations team builds these bundles once per occasion/persona through a simple UI (Admin → Knowledge Base → Relationships), the same way they'd brief a real concierge on "what we usually suggest for anniversaries." This keeps V1 shippable — it's a curation UI, not a machine-learning project.
- **V2+** can layer in auto-suggested relationships (co-occurrence in real guest conversations, booking data once PMS integration exists) with the admin-curated edges as the trusted seed set and ground truth for evaluating any auto-suggestions.

This relationship layer — not a bigger model — is the concrete, defensible answer to "why can't a hotel just use a generic AI chatbot": a generic chatbot searches documents, this understands that an anniversary, an ocean-view suite, and a couples massage are the same recommendation.

---

**Next document:** [Conversation Playbook](04-conversation-playbook.md) (aka the *Conversation Design Bible*) — 50–100 scripted scenarios exercising every domain (§2), journey state (ABS §16), escalation trigger (ABS §7), and relationship bundle (§12) defined so far, used both as a pre-launch QA pass and as the seed set for the eval rubric ([ABS §15](02-ai-behavior-specification.md)).
