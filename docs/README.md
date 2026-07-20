# Hospitality AI OS — Documentation Index

**Module:** AI Concierge · **Version:** 1.0

Ten documents, read in order the first time; used as reference after that. Each depends only on the ones before it — nothing forward-references.

| # | Document | Answers |
|---|---|---|
| 1 | [Product Requirements](01-PRD-ai-concierge.md) | What are we building and why? Features, scope, success criteria. |
| 2 | [AI Behavior Specification](02-ai-behavior-specification.md) | How should the concierge think, speak, refuse, and escalate? |
| 3 | [Information Architecture](03-information-architecture.md) | What does the AI know, and how is it organized/retrieved? |
| 4 | [Conversation Playbook](04-conversation-playbook.md) | Does the spec actually hold up against real guest language? (64 scenarios) |
| 5 | [User Experience Flows](05-user-experience-flows.md) | What does a human see and tap — guest widget and admin portal? |
| 6 | [System Architecture](06-system-architecture.md) | What services, request flows, and deployment topology deliver this? |
| 7 | [Database Design](07-database-design.md) | Prisma schema, ERD, multi-tenant RLS, indexing. |
| 8a–d | UI Design System — [A](08-ui-design-system.md) · [B](08-ui-design-system-option-b.md) · [C](08-ui-design-system-option-c.md) · [D](08-ui-design-system-option-d.md) | What does it look and move like? Four directions, **decision pending**. |
| 9 | [API Specification](09-api-specification.md) | Exact request/response contracts, especially the SSE streaming protocol. |
| 10 | [AI Engine Specification](10-ai-engine-specification.md) | Every model call: which one, what it costs, how it fails. |
| 11 | [Development Plan](11-development-plan.md) | Build order, testing strategy, environment setup. |
| 12 | [Engineering Conventions](12-engineering-conventions.md) | Repo structure, naming, state management, validation, logging, git workflow — how the code stays consistent day to day. |
| 13 | [Sales Demo Script](13-sales-demo-script.md) | The pitch: what to say to Adam, in what order, and the one ask. |
| 14 | [Sprint Backlog & Development Roadmap](14-sprint-backlog.md) | The actual checklist — every phase broken into checkable tickets. **This is the living document; update it as work happens, don't just read it.** |
| 15 | [Prompt Library Implementation Prompts](15-prompt-library-implementation-prompts.md) | Six ready-to-paste prompts for a Claude Code session — scaffold the library, then one per module. |
| 16 | [Demo Property: Bellevue Hotel](16-demo-property-content.md) | Real content for the demo site and knowledge-base ingestion testing — rooms, dining, spa, policies, relationship bundles, photography sourcing. |
| 17 | [Landing Page Plan](17-landing-page-plan.md) | Devsphinx's own product page — different audience than the Bellevue demo, not shown to Adam. |

## Quick lookups

- **"How does RAG/retrieval actually work?"** → [IA §5–7](03-information-architecture.md) (ingestion, chunking, retrieval pipeline) + [Architecture §4](06-system-architecture.md) (where it sits in the per-message flow) + [AI Engine §1–5](10-ai-engine-specification.md) (the actual calls, reranking, confidence formula).
- **"How many model calls does one message cost?"** → [AI Engine §1, §7](10-ai-engine-specification.md) — three per guest message, cost validated against the earlier budget estimate.
- **"Where do the actual system prompts live, and how many are there?"** → [AI Engine §3](10-ai-engine-specification.md) — the Prompt Library: one base template + composable domain/persona modules, plus the classifier and entity-extraction prompts.
- **"How is the codebase organized?"** → [Architecture §3](06-system-architecture.md) (modular monolith folder structure) + [API §4](09-api-specification.md) (module-to-endpoint mapping).
- **"What's the deployment/hosting decision, and why?"** → [Architecture §8](06-system-architecture.md) — single-platform Vercel, Upstash+BullMQ queue, cost tier notes.
- **"What's stored, and how is tenant data isolated?"** → [Database Design](07-database-design.md), especially §9 (RLS).
- **"What does the guest actually see?"** → [UX Flows](05-user-experience-flows.md) + whichever [design system option](08-ui-design-system.md) is chosen.
- **"What can't the AI do / say?"** → [ABS §10, §19](02-ai-behavior-specification.md) (refusals, forbidden behaviors).
- **"Is a proposed feature already in scope?"** → Check PRD §18–19 (future modules / MVP scope) before assuming it's new.

## Status

- **Design decision open:** four UI Design System options exist (§8a–d) — not yet chosen. Option D is a behavioral layer, not a competing look; it combines with A, B, or C.
- **Everything else:** stable, cross-referenced, no known contradictions as of the last consistency pass.
- **Planning is complete — 14 documents written.** Work now happens against the [Sprint Backlog](14-sprint-backlog.md), starting with Sprint 0's Week 0 spike — check its boxes off as you go rather than re-reading the specs each session.
