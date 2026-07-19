# UI Design System — Option D (The Grammar of Service)

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0 — fourth direction, decision pending
**Companions:** [Option A — Heritage](08-ui-design-system.md) · [Option B — Platform-Native](08-ui-design-system-option-b.md) · [Option C — The Night Concierge](08-ui-design-system-option-c.md)

**This is a service manual, not a style guide.** Options A, B, and C are three answers to "what should it look like." D refuses the question. No guest has ever left the Ritz saying "excellent typography." They remember how service *moved* — the doorman who saw them before they reached the door, the pause before the sommelier spoke, the tray presented rather than handed over, the room that went quiet when something went wrong. Option D's primitives are not Button, Card, and Modal. They are **moments of service**, **registers of voice**, and **tempo** — with the visual layer deliberately subordinate to all three.

The deepest consequence: **D is orthogonal to A, B, and C.** It specifies *behavior in time*; they specify *appearance in space*. D can be layered onto any of them — which makes it less a competing option than the missing half of whichever option wins.

---

## 1. First Principle — Service Is Choreography

Every great hotel trains its staff on sequences, not surfaces: The Ritz-Carlton's three steps of service, the rule that a waiter never hurries two things at once, the maître d's beat of eye contact before speaking. Software design systems have no vocabulary for any of this — they specify what a card looks like, never *how it enters the room*.

So D's token categories, in order of authority:

1. **Moments** — the seven choreographed sequences of a service encounter (§2)
2. **Registers** — the four voices the interface speaks in (§3)
3. **Tempo** — time as a designed material (§4)
4. **Materials** — the visual layer, last and least (§5)

## 2. The Seven Moments of Service

Each moment maps to a screen state that already exists in the [UX Flows](05-user-experience-flows.md) — D doesn't invent new flows, it choreographs the ones we have:

| Moment | Hospitality analogue | What it specifies | Maps to |
|---|---|---|---|
| **The Arrival** | The doorman sees you before you reach the door | The launcher doesn't appear — it *acknowledges*: fades in after the settled pause, labeled as an offer of help, never a demand for attention | [UX §2](05-user-experience-flows.md) launcher delay, extended into a full pattern |
| **The Approach** | Eye contact before speech | On every guest message: an acknowledgment cue within 300ms (a hairline drawing itself under the concierge's name — the interface's version of meeting your eyes), *then* the Breath (§4), *then* speech | New — replaces the naked spinner/typing indicator entirely |
| **The Presentation** | The tray, not the handoff | Anything offered (a room, a dinner, an itinerary) rises gently into place and *settles* — 400ms in which nothing else on screen may move. Presented things are held until acknowledged, never auto-dismissed | [UX §3](05-user-experience-flows.md) recommendation card, given entrance choreography |
| **The Accompaniment** | Walked to the elevator, not pointed at it | External handoffs (Book Now, the events team) are escorted: the concierge states where you're going and remains present until you've arrived — never a bare link that dumps the guest elsewhere | [UX §6](05-user-experience-flows.md) CTA behavior |
| **The Discretion** | The room lowers its voice | On Service Recovery ([ABS §16](02-ai-behavior-specification.md)): the interface literally dims — ornament withdraws, gold disappears, suggestions fold away, type quiets. The UI equivalent of a manager stepping out from behind the desk | [UX §5](05-user-experience-flows.md) escalation, made sensory instead of just structural |
| **The Withdrawal** | Staff leave without being noticed | Dismissals, closings, and idle states exit by receding, never by snapping shut. The idle concierge goes still — it does not re-prompt, nudge, or badge | [UX §2](05-user-experience-flows.md) idle state |
| **The Turndown** | The note left on the pillow | When a conversation naturally ends, the concierge leaves one quiet card: what was discussed, the single next step, nothing else. Then silence | New pattern — the graceful form of lead capture's follow-up, and the last thing the guest sees |

## 3. Registers — One Voice, Four Tones

A concierge never changes *person*; they change *tone*. The interface does the same: one type family, one palette — but four **registers**, each a coordinated setting of size, spacing, tempo, word budget, and ornament. Components don't have "variants." They have registers.

| Register | When ([ABS §16](02-ai-behavior-specification.md) journey states) | Voice | Tempo | Word budget | Gold |
|---|---|---|---|---|---|
| **Ceremonial** | Occasions — anniversary, honeymoon, wedding (Planning at its height) | Larger, wider-set, unhurried | Slowest | ~40 words/turn | Permitted (once) |
| **Warm** | Everyday Planning and Booking Intent | Default — relaxed, personal | Standard | ~60 | Sparing |
| **Efficient** | Information; Business Traveler persona ([ABS §12](02-ai-behavior-specification.md)) | Compact, direct, no flourish | Brisk | ~25 | None |
| **Hushed** | Service Recovery — always | Smaller, softer contrast, slower | Slowest + longer Breath | ~35 | **Forbidden** |

**This is the ABS's Guest Opportunity Engine made visible.** The journey-state classifier ([ABS §16](02-ai-behavior-specification.md)) already decides *what* the concierge should do; registers decide how the entire interface *carries itself* while doing it. Same copy content, four registers:

> **Ceremonial:** "Breakfast is served in the Palm Court from seven until half past ten."
> **Warm:** "Breakfast runs 7–10:30 — if you're early risers, the terrace at opening is worth it."
> **Efficient:** "Breakfast: 7:00–10:30, Palm Court."
> **Hushed:** "Breakfast is 7–10:30. I've let the kitchen know about the allergy you mentioned."

Copy is design material here, not content poured into a design.

## 4. Tempo — Time as a Token

The most contrarian claim in this document: **a concierge that answers too fast feels robotic.** Instant, complete responses read as vending-machine service. D specifies time:

| Token | Value | What it is |
|---|---|---|
| `--tempo-acknowledge` | ≤ 300ms | The Approach's eye-contact cue. This satisfies the PRD's "<2s response start" NFR — the guest is *answered* immediately; they are *spoken to* after the Breath |
| `--tempo-breath` | 700ms (900ms in Hushed) | The pause between acknowledgment and speech — the beat a considered person takes before answering |
| `--tempo-reveal` | Reading pace, not network pace | Streamed text arrives at the cadence of a calm speaking voice — a words-per-second ceiling, decoupled from token throughput. The network may be faster; the *presentation* never is |
| `--tempo-settle` | 400ms | After any Presentation: nothing else moves |
| **The One-Gesture Rule** | — | No two animated things at once, ever. A waiter never hurries two tasks in view of a guest |

**Accessibility is the override, not the exception:** under `prefers-reduced-motion`, all tempo collapses to instant final states. Choreography is an enhancement layered on a fully functional instant interface — never a gate in front of it.

## 5. Materials — the Visual Layer, Deliberately Last

Because behavior does the differentiating, the visual layer is nearly monochrome — a printed service manual:

- **Card stock** `#F6F3EC` — the ground. Ivory, matte, print-like.
- **Ink** `#26241F` — one text color, softened to 70% strength in Hushed register.
- **Gold leaf** `#B08D4A` — not an accent color, a *material with a quota*: **once per view, maximum.** The Approach's hairline, or one presented card's edge — never both. Gold that appears everywhere is gilt; gold that appears once is leaf.
- **Glass** — the Discretion dim: a quieting veil over everything that isn't the conversation.
- **Linen** `#E2DCCF` — rules, dividers, structure.

Status/semantic colors exist only Back of House, as in the other options — the guest never sees a status color.

## 6. Typography — One Voice

One family throughout: **Baskerville** (the "polite" typeface — license a proper digital cut for the build). Roman for statement, *italic for warmth*, small caps with wide tracking for wayfinding, size and leading doing the register work. No second family on the guest side; a concierge does not switch voices mid-sentence. Mono appears only Back of House, for the ledger's figures.

## 7. The Silence Budget

Luxury interfaces are usually described as "minimal." D makes quietness *enforceable*:

- Maximum **one** Presentation on screen at a time (already the rule — [ABS §9](02-ai-behavior-specification.md); here it becomes visual law)
- Maximum **one** suggested next step per turn — never a menu of chips after every message
- **Zero** badges, counters, or notification dots anywhere the guest can see
- Word budgets per register (§3) are enforced in the prompt layer, not aspirational
- The idle interface does **nothing**. No pulsing, no re-prompts, no "still there?" — stillness is a feature ([UX §2](05-user-experience-flows.md) already says this; D gives it a name and a budget)

## 8. Back of House

The registers apply to staff, too: the admin defaults to Efficient (staff are working), switches to Hushed when reviewing a Service Recovery transcript — the ledger dims out of respect for what it records. Otherwise Back of House inherits whichever visual option (A/B/C) it's paired with; D has no opinion about dashboard chrome, only about conduct.

## 9. Four Directions, One Product

| | A — Heritage | B — Platform | C — Nocturne | D — Grammar of Service |
|---|---|---|---|---|
| The bet | Specificity | Familiarity | Atmosphere | **Conduct** |
| Primitive | Component | Component | Component + clock | **Moment, register, tempo** |
| Axis | Space (what it looks like) | Space | Space + time of day | **Time (how it behaves)** |
| Signature | Chosen palette & serif | Experience cards | Dusk dial | The Breath, the Presentation, the Discretion dim, the Turndown |
| Can combine with others? | With D | With D | With D | **With any of them** |

**The recommendation hiding in this table:** D isn't really a fourth competitor. It's the behavioral layer the other three are missing — pick A, B, or C for the look, and let D govern how it moves. In the demo to Adam, the moment the room dims for a complaint, or the concierge takes a breath before answering, is the moment this stops being "a chatbot with nice fonts."

---

**See also:** [Option A](08-ui-design-system.md) · [Option B](08-ui-design-system-option-b.md) · [Option C](08-ui-design-system-option-c.md)
