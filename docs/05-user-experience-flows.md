# User Experience Flows

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [AI Behavior Specification](02-ai-behavior-specification.md) · [Information Architecture](03-information-architecture.md) · [Conversation Playbook](04-conversation-playbook.md)

Everything so far defines what the concierge knows and how it behaves. This document defines what a human actually sees and taps — the guest-facing widget and the admin portal it's operated from. It is the last document before visual design (UI Design System, next-but-one) and the first one Adam will actually recognize as "the product," so it needs to read as an experience, not a wireframe spec.

---

## 1. Design Principles

These carry directly into the eventual UI Design System — recorded here because they constrain flow decisions, not just visuals:

- **It should not look like a chatbot.** No bubble-and-avatar cartoon styling, no bouncing three-dot "typing…" in a speech balloon. Think Aman, Rosewood, Apple — quiet, generous whitespace, restrained motion.
- **Mobile-first.** Most hotel-site visitors researching a stay are on a phone. Every flow below is designed for a narrow viewport first, then expanded for desktop.
- **The concierge is staff, not a widget.** Per [ABS §2](02-ai-behavior-specification.md), the interface should reinforce persona (named avatar, hotel branding) rather than a generic "Chat" icon.
- **Recommendations are shown, not just told.** Per [ABS §9](02-ai-behavior-specification.md) and the relationship bundles in [IA §12](03-information-architecture.md), a room or package recommendation renders as a small rich card (photo, name, one-line hook), not a wall of prose — this is what makes "Convert" ([Playbook §1](04-conversation-playbook.md)) feel like discovery instead of a sales pitch.
- **Every screen has a next step.** Mirrors the [Response Structure Template](02-ai-behavior-specification.md) — no dead-end states, guest or admin side.
- **Mobile is a full-screen takeover, not a shrunken desktop widget.** The concierge should feel like a native messaging app on a phone — large tap targets, full viewport, smooth streaming — never a cramped floating box squeezed into a corner.

**Quick gut-check** (same pattern as the [Playbook's](04-conversation-playbook.md) plain-English companion to its rubric) — every screen should answer three questions without the user having to think about it: What is happening right now? What should I do next? Can I complete my goal in fewer steps than this? If any answer isn't obvious at a glance, simplify before adding anything else.

## 2. Guest Widget — Anatomy

```
┌───────────────────────────────┐
│  {{avatar}}  {{concierge_name}}│  ← header: hotel branding, never "AI Chat"
├───────────────────────────────┤
│                               │
│   message thread              │  ← concierge messages left, guest right
│   (streaming text, markdown)  │
│                               │
│   [ Recommendation Card ]     │  ← rich card, optional, max one at a time
│                               │
│   [ Quick reply chips ]       │  ← optional, contextual (e.g. "Yes" / "Tell me more")
│                               │
├───────────────────────────────┤
│  [ text input ]        [Send] │
└───────────────────────────────┘
```

**States:**

| State | Trigger | Behavior |
|---|---|---|
| Collapsed / Launcher | Default on page load | Small branded launcher, bottom-right (desktop) or bottom-anchored bar (mobile). Never auto-opens, and doesn't even appear instantly — a brief pause (roughly 5–8 seconds) before it renders, labeled with a hospitality-toned invitation ("Need help planning your stay?") rather than generic "Chat with us" copy. The delay and the wording both matter: an instant "Chat with us" bubble is the single fastest way to read as software instead of hospitality. |
| Opening | Guest taps launcher | Expands with the Welcome message ([Playbook G-00](04-conversation-playbook.md)) already in place, plus the suggested-question chips and quick-start selector below — no empty state, no "Loading…" |
| Active | Mid-conversation | Streaming response text (per [PRD FR-002](01-PRD-ai-concierge.md)), a restrained typing indicator (a soft pulse, not bouncing dots) |
| Recommendation shown | Concierge offers a suggestion | Rich card renders inline in the thread — see §3 |
| Lead capture | Signal fires ([ABS §8](02-ai-behavior-specification.md)) | Conversational inline prompt for one field, never a form (§4) |
| Escalating | Trigger fires ([ABS §7](02-ai-behavior-specification.md)) | Handoff panel — see §5 |
| Idle / re-engagement | No guest activity for a period, mid-session | Concierge does not nag or re-prompt; stays silent until the guest returns |
| Closed | Guest dismisses widget | Conversation persists for the session ([ABS §11](02-ai-behavior-specification.md)) — reopening resumes, doesn't restart |

### Opening State — Suggested Questions & Quick-Start Selector

The Opening state ([PRD FR-001](01-PRD-ai-concierge.md)) carries two complementary affordances, not just the greeting text:

- **Suggested question chips** — 3–4 tappable examples pulled from the hotel's own top domains ([IA §2](03-information-architecture.md)), e.g. "Which room is best for families?", "Tell me about your spa", "We're celebrating an anniversary." These give a guest who doesn't know what to ask a frictionless start.
- **Quick-start experience selector** — a row of options like `Family Holiday` · `Romantic Escape` · `Business Trip` · `Wedding` · `Spa Retreat` · `Just Exploring`. This is worth calling out as its own affordance rather than folding it into the chips above: tapping one sets an explicit `persona` ([ABS §12](02-ai-behavior-specification.md)) or `context_tag` ([IA §12](03-information-architecture.md)) in the same turn — "Romantic Escape" triggers exactly the same relationship-bundle path as if the guest had typed "we're celebrating our anniversary" (see [G-05](04-conversation-playbook.md)). No new backend mechanism is needed; this is a UI shortcut directly onto infrastructure that already exists. It also sidesteps the "ask a clarifying question first" step ([Playbook G-16](04-conversation-playbook.md)) for guests willing to self-select, without changing that rule for guests who'd rather just start typing.

Both are optional, never forced — a guest can ignore both and type freely, and the concierge behaves identically either way.

## 3. Recommendation Card

The concrete UI answer to "recommendations are shown, not told":

```
┌─────────────────────────────┐
│  [ photo ]                  │
│  Ocean View Suite            │
│  Private balcony · Sea views │
│  [ View Room → ]             │
└─────────────────────────────┘
```

- Sourced directly from the relevant [entity](03-information-architecture.md) (Room Type, Spa Treatment, Restaurant, Event Space) — photo and one-line hook only, never a spec dump inline.
- At most **one card per turn** — mirrors [ABS §9](02-ai-behavior-specification.md)'s "one adjacent suggestion, not three." A relationship bundle ([IA §12](03-information-architecture.md), e.g. the anniversary bundle) renders as a small horizontally-scrollable set of 2–3 cards under a single sentence of framing, not three separate messages.
- "View Room →" deep-links to the existing hotel website's room page — MVP has no in-widget booking flow ([PRD §19](01-PRD-ai-concierge.md)).

## 4. Lead Capture Flow

Never a form. One field, inline, in the thread, with the reason stated in the same breath (per [ABS §8](02-ai-behavior-specification.md)):

```
Concierge: Would you like me to prepare a full anniversary
           recommendation and send it your way?
           [ Yes ]   [ No thanks ]

Guest:     [taps Yes]

Concierge: Wonderful — what dates are you considering?

Guest:     [types dates]

Concierge: And what's the best email to send it to?

Guest:     [types email]

Concierge: Sent! Anything else I can help you plan?
```

- **A quick-reply Yes/No confirmation always precedes the first field ask.** This is a deliberate extra step beyond a bare field prompt — it turns lead capture into something the guest opts into with one tap, rather than something that starts the moment they answer a question. A "No thanks" tap ends the ask cleanly with zero friction.
- Each field appears as a normal chat turn — never a modal, never multiple fields at once. **Cap what's asked for in any one conversation at 2–3 fields** (typically name/email + the one detail already volunteered, like dates) — [PRD FR-007](01-PRD-ai-concierge.md) lists every field the platform *can* capture across scenarios, but that's a menu for what's relevant when, not a checklist to work through in a single chat.
- A subtle inline affordance (e.g. a native-feeling input mask for email/phone) is acceptable *within* the chat bubble, but the surrounding flow must still read as conversation, not a form interrupting one.
- Declining is a dead-end-free path: if the guest ignores, says no, or taps "No thanks," the concierge continues normally — no retry, no guilt language (per [ABS §8](02-ai-behavior-specification.md) rules).

## 5. Escalation / Handoff Flow

```
Trigger fires (ABS §7)
        │
        ▼
One-sentence in-character acknowledgment
(no "please wait" dead air)
        │
        ▼
Handoff panel appears inline:
┌───────────────────────────────┐
│  Let's get you the right help │
│  ○ Connect me now (if staff online)
│  ○ Email me / call me back    │
└───────────────────────────────┘
        │
        ▼
Guest picks a path
        │
   ┌────┴─────┐
   ▼          ▼
Live handoff   Contact capture
(if channel    (folds into §4,
 available)     transcript attached silently)
        │
        ▼
Confirmation: "Our team has your conversation
and will follow up shortly."
```

- **Service Recovery cases** ([ABS §16](02-ai-behavior-specification.md), [Playbook G-11](04-conversation-playbook.md)) skip straight to this panel — no recommendation card, no quick-reply chips, nothing that could read as the concierge moving on before the guest's issue is acknowledged.
- The transcript + detected intent travel with the handoff automatically — the guest is never asked to repeat what they already said ([ABS §7](02-ai-behavior-specification.md)).

## 6. CTA Visibility by Trip Lifecycle Stage

Ties directly to [Playbook §6](04-conversation-playbook.md) — the widget's persistent action area is not static:

| Lifecycle stage (inferred) | Primary CTA shown |
|---|---|
| Dreaming / Researching / Comparing | "Explore Rooms" / booking-engine deep link |
| Booking Intent | "Book Now" (external link, [PRD FR-006](01-PRD-ai-concierge.md)) |
| Preparing (already booked) | "Plan My Stay" (itinerary/local-guide framing) — **never** "Book Now" |
| Staying (on-property signals) | "Request Assistance" — routes toward escalation/staff, not marketing |

## 7. Guest Flow Diagrams

**First-time visitor, Planning journey state:**

```
Land on homepage → Launcher visible (not auto-opened)
   → Guest taps → Welcome message (G-00)
   → Guest states occasion ("anniversary")
   → Concierge asks one clarifying question if underspecified (Playbook G-16)
   → Recommendation bundle card(s) (§3)
   → Lead capture offered (§4)
   → Guest provides email or declines
   → Concierge invites next question (Response Structure Template, ABS §18)
```

**Service Recovery (in-house guest):**

```
Guest: "The AC in my room isn't working" (already checked in — Staying stage)
   → Journey state = service_recovery (ABS §16) — detected before topical intent
   → One-sentence empathy, no troubleshooting attempt
   → Escalation panel (§5) immediately — no recommendation, no CTA bar change first
   → Handoff confirmed
```

**Returning guest ("Welcome back, last time we discussed...") — explicitly out of scope for V1.** It's tempting to design this because it reads as impressively intelligent, but it directly conflicts with [ABS §11](02-ai-behavior-specification.md): cross-session guest memory is a deliberate privacy boundary, not just an unbuilt feature, and referencing a prior conversation without consent and a persistent guest identity (which doesn't exist until CRM/PMS integration) is the wrong tradeoff to make for a demo flourish. This becomes a real flow in V3 ([PRD §18](01-PRD-ai-concierge.md), Guest Memory) once consent and identity are actually in place — noted here so it doesn't quietly get designed into the MVP screens.

## 8. Admin Portal — Screen Map

Maps directly to [PRD §10](01-PRD-ai-concierge.md), with roles from [PRD §16](01-PRD-ai-concierge.md) gating visibility:

```
Login
  │
  ▼
Dashboard  ─────────────────── (Agency Admin: cross-hotel view; Hotel Admin: single property)
  │
  ├── Hotels (Agency Admin only — portfolio list, see below)
  ├── Knowledge Base
  │     ├── Documents (upload, status, chunk preview — IA §5)
  │     └── Relationships (bundle builder — IA §12, new surface, §10 below)
  ├── Conversations (transcript viewer + QA scoring — ABS §15)
  ├── Leads (inbox — PRD §13)
  ├── Analytics (PRD FR-010, see below)
  ├── Brand Settings (tone preset picker — ABS §2, greeting, avatar, colors)
  ├── Prompt Settings (system prompt template preview — ABS §14, read mostly, edit guarded)
  ├── Integrations (PRD §10)
  ├── Billing (PRD §10)
  └── Users & Roles (PRD §16)
```

### Dashboard at a Glance

The Hotel Admin dashboard is tiles, not a landing page of links — every number pulled directly from the metrics already defined in [PRD §5 / FR-010](01-PRD-ai-concierge.md), just given a concrete surface here:

```
┌───────────────┬───────────────┬───────────────┐
│ Chats Today    │ Qualified     │ Escalations    │
│ 128            │ Leads: 12     │ 3              │
├───────────────┼───────────────┼───────────────┤
│ Answered w/o   │ Guest          │                │
│ Handoff: 96%   │ Satisfaction:  │                │
│                │ 4.8            │                │
└───────────────┴───────────────┴───────────────┘
```

A single glance should answer "is the concierge earning its keep this week" without opening Analytics.

### Spherical Agency Portfolio View

This is the screen Adam's team actually lives in day to day, and it's the clearest signal in the whole admin experience that this is a platform, not a single-hotel tool — worth designing deliberately rather than treating "Hotels" as a plain list:

```
Hotels                          Health Score
─────────────────────────────────────────────
Rosewood                        ● 94
Bellevue                        ● 88
EDITION                         ⚠ 61  (2 docs need review)
Graduate                        ● 90
```

Each row's **Health Score** rolls up three signals already defined elsewhere in this spec, not a new metric invented for this screen: knowledge-base completeness ([IA §9](03-information-architecture.md) — % of chunks `Indexed` vs. `Needs Review`/`Failed`), lead generation rate, and chat volume. A low score with an inline reason ("2 docs need review") is what turns this from a vanity dashboard into something an account manager checks every morning to know which client needs attention.

## 9. Admin Flow — Knowledge Upload & Validation

The screen that has to hit the PRD's "upload content in under 30 minutes" bar ([PRD §20](01-PRD-ai-concierge.md)):

```
Admin drags PDF/DOCX onto Knowledge Base screen
        │
        ▼
Upload progress → Parsing → Entity extraction (IA §5)
        (progress labels: "Reading…" → "Chunking…" → "Embedding…" → "Ready" —
         plain-language status, not raw pipeline terminology)
        │
        ▼
Status badge per document:
  ● Indexed        → live, eligible for retrieval
  ● Needs Review   → validation flagged a gap (IA §9) — e.g. "Room Type found, capacity missing"
  ● Failed         → parse error, re-upload prompt
        │
        ▼
Admin clicks "Needs Review" → guided form pre-filled with what
was auto-extracted, only the missing fields are asked for
        │
        ▼
Save → re-validates → Indexed
```

- Chunk preview (per [PRD FR-003](01-PRD-ai-concierge.md)) is available per document — a collapsible list of the actual chunks + tags that will be retrievable, so an admin can sanity-check what the AI "sees" without reading raw embeddings.
- Domain tags ([IA §2](03-information-architecture.md)) are auto-suggested, admin-confirmed with a single tap, not typed from scratch.

## 10. Admin Flow — Relationship Bundle Builder

New UI surface implied by [IA §12](03-information-architecture.md) — this did not exist as a screen concept before this document:

```
Knowledge Base → Relationships → "New Bundle"
        │
        ▼
Pick a context tag (anniversary / honeymoon / family / from a
suggested list, or type a new one)
        │
        ▼
Add entities to the bundle by searching existing indexed
entities (Room Type, Restaurant, Spa Treatment, Experience...)
        │
        ▼
Preview: "This is what the concierge will say when a guest
mentions {{context_tag}}" — renders the actual recommendation
card set (§3) as it would appear to a guest
        │
        ▼
Save
```

This preview-as-you-build step matters: it's the one screen in the whole admin portal that directly answers "will this feel right to a guest," which is the same question Adam will be asking about the whole product. It's also exactly what fires when a guest taps the quick-start selector in the widget (§2) — "Romantic Escape" and typing "we're celebrating our anniversary" preview identically here, because they resolve to the same `context_tag`.

## 11. Admin Flow — Conversation Review

```
Conversations list (filterable by hotel/date/escalated/lead-captured)
  — each row shows at-a-glance: guest topic tags (IA §2 domains
    the conversation touched, e.g. Spa · Wedding · Airport Transfer)
    and a Lead Score, so staff can triage without opening every thread
        │
        ▼
Select a transcript
        │
        ▼
Thread view + inline QA Rubric scoring (ABS §15):
  Grounding · Tone · Escalation · Lead Capture · Resolution
        │
        ▼
"Flag for Playbook" → converts this transcript into a new
scenario using the schema in Playbook §2 (closes the loop
described in Playbook §7)
```

## 12. Admin Flow — Analytics (Insights, Not Charts)

The failure mode to avoid here is a wall of line graphs nobody acts on. Every metric on this screen pairs with what to *do* about it — this is the screen that turns the ABS's confidence-band tracking ([ABS §5](02-ai-behavior-specification.md)) and the IA's validation states ([IA §9](03-information-architecture.md)) into something a non-technical hotel marketing manager can act on directly:

```
Guests Ask Most About         Missing Information
  Spa                           Pet Policy (12 Low-Confidence
  Airport Transfer               answers this week — no
  Check-in                       indexed content found)
  Family Rooms
                               ─────────────────────────────
                               Recommended Action
                               → Upload your Spa Menu
                               → Add a Pet Policy document
```

- **"Guests Ask Most About"** is just the domain-tag ([IA §2](03-information-architecture.md)) distribution of real conversations — cheap to compute, immediately useful for a hotel deciding what content matters.
- **"Missing Information"** surfaces topics where the concierge repeatedly hit the Low-Confidence band ([ABS §5](02-ai-behavior-specification.md)/§6) — this is the guest-facing honesty rule ("I don't have confirmed information...") converted into a content-gap worklist instead of a silent, repeated failure. It's the single highest-leverage screen for actually hitting the PRD's knowledge-completeness goals, because it tells the hotel exactly what to upload next instead of leaving them guessing.
- **"Recommended Action"** is a direct, specific instruction ("Upload your Spa Menu"), not a vague nudge — mirrors the same plain-language principle as the Knowledge Upload progress labels above.

## 13. Error & Edge States

| Condition | Guest-facing behavior |
|---|---|
| Model/network failure mid-stream | Graceful message ("I'm having trouble responding right now — let me connect you with our team"), not a broken half-sentence or silent hang |
| No relevant knowledge indexed at all for a hotel (new tenant, empty KB) | Concierge stays honest per [ABS §6](02-ai-behavior-specification.md); admin sees an "empty knowledge base" warning before the widget ever goes live on that hotel's site |
| Staff channel offline for live handoff | Only the "email me / call me back" path is offered — never a dead "Connect me now" option |
| Guest returns after long absence, session expired | Fresh Welcome ([Playbook G-00](04-conversation-playbook.md)), no attempt to fake continuity from an expired session |

## 14. MVP Screen Inventory

The concrete checklist this document exists to produce — feeds directly into the UI Design System and Development Plan:

**Guest-facing:** Launcher · Widget (collapsed/active/escalating states) · Suggested-question chips + quick-start selector · Recommendation card · Lead-capture inline prompt (with Yes/No confirmation) · Handoff panel

**Admin:** Login · Dashboard (KPI tiles) · Hotels / Agency Portfolio view (health score) · Knowledge Base (upload, document list, chunk preview) · Relationship Bundle builder · Conversations list (topic tags + lead score) · Conversation thread + QA scoring · Leads inbox · Analytics (top topics, missing information, recommended actions) · Brand Settings · Prompt Settings · Integrations · Billing · Users & Roles

---

**Next document:** [System Architecture Blueprint](06-system-architecture.md) — the services, data flow, and API boundaries needed to actually deliver every screen and state above.
