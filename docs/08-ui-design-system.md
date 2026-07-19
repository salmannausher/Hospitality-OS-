# UI Design System

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [AI Behavior Specification](02-ai-behavior-specification.md) · [User Experience Flows](05-user-experience-flows.md) · [Database Design](07-database-design.md)
**This is "Option A — Heritage Concierge."** Three other directions exist in parallel — [Option B — Platform-Native](08-ui-design-system-option-b.md), [Option C — The Night Concierge](08-ui-design-system-option-c.md), and [Option D — The Grammar of Service](08-ui-design-system-option-d.md) (a behavioral layer that can combine with any of the others) — decision pending, not yet chosen.

Every screen and state in the [UX Flows](05-user-experience-flows.md) document exists conceptually already — this is where it gets an actual visual language: color, type, spacing, motion, and a concrete component library. The central design problem this document solves isn't "make it pretty" — it's **making one system render convincingly as Rosewood's concierge and EDITION's concierge without looking like the same product wearing two different hats.**

---

## 1. The Real Design Problem: Themeable, Not Fixed

This is not a single-brand design system with a color palette chosen once. `BrandSettings` ([DB Design §4](07-database-design.md)) already stores `primaryColor`, `secondaryColor`, `fontFamily`, `logoUrl`, and a `tonePreset` per hotel — the design system has to be the thing that turns those four fields into something that reads as genuinely bespoke, not "a template with your logo pasted on."

**The mechanism: CSS custom properties, resolved at runtime, not at build time.** Tailwind's static theme config can't hold per-tenant colors (there's one build, serving every hotel). Instead, every themeable value is a CSS variable — `--brand-primary`, `--font-display`, etc. — set via an inline `<style>` block or `data-hotel` attribute scoped to the widget/portal root, populated from `BrandSettings` at request time. Tailwind utility classes reference the variables (`bg-[var(--brand-primary)]`) rather than hardcoded hex values. One compiled CSS bundle; unlimited hotel themes.

**What stays fixed regardless of hotel** (this is what prevents "themeable" from sliding into "inconsistent quality"): spacing scale, type scale, motion timing, radius scale, and the component structure itself. A hotel can change *what color* the recommendation card's accent border is; it cannot change that recommendations render as one card with a photo and a one-line hook, or that the widget takes 5–8 seconds to appear. Brand customization is real, but it's customization of the token values inside a fixed structural language — never the other way around.

## 2. Tone Presets → Token Sets

[ABS §2](02-ai-behavior-specification.md) already defines four tone presets for *voice*. This system extends each one to a visual starting point — a hotel picks a preset in Brand Settings and gets a coherent look immediately, then overrides individual tokens if needed:

| Preset | Type pairing | Radius | Motion | Feel |
|---|---|---|---|---|
| Classic Luxury | Serif display (headings/concierge name) + clean sans (body) | Soft, minimal (8–12px) | Slow, deliberate (300–400ms) | Rosewood, Waldorf Astoria |
| Modern Luxury | Refined sans throughout, generous letter-spacing on display text | Soft (8–12px) | Standard (200–300ms) | EDITION, Proper Hotels |
| Boutique | Warmer sans, slightly more character | Rounded (12–16px) | Standard, a touch more playful easing | Graduate Hotels |
| Family-Friendly | Rounded sans, friendly but not childish | Rounded (12–16px) | Standard | Family resorts |

No preset uses a "chat app" visual language (bright bubbles, cartoon avatars, gradient backgrounds) — that's the one thing held constant across all four, because it's the thing [UX §1](05-user-experience-flows.md) identified as the fastest way to read as software instead of hospitality.

## 3. Foundation — Color

**Neutral scale does the heavy lifting.** Per the "quiet, generous whitespace" principle, most of any screen is neutral — warm off-whites and near-blacks rather than clinical pure white/black, closer to hotel stationery than to a typical SaaS dashboard:

```
--neutral-0    #FAF9F7   (page/widget background — warm white, not #FFFFFF)
--neutral-100  #F0EEEA
--neutral-300  #D8D4CC
--neutral-600  #6B6459
--neutral-900  #1C1A16   (primary text — warm near-black, not #000000)
```

**Brand tokens are accents, not backgrounds.** `--brand-primary` (from `BrandSettings.primaryColor`) appears on: the concierge avatar ring, the primary CTA button, active/selected states, the recommendation card's accent border. It does **not** flood large surface areas — a hotel's brand color used as a full-bleed header background is exactly the "loud SaaS" look this system avoids. `--brand-secondary` is reserved for secondary actions and subtle highlights.

**Semantic tokens (fixed, not themeable)** — these carry meaning and must stay legible/consistent regardless of hotel branding:

```
--status-indexed        muted green    (Document/Chunk: Indexed)
--status-needs-review   muted amber    (Needs Review)
--status-failed         muted red      (Failed)
--confidence-high        muted green    (ABS §5 confidence band, admin-facing only)
--confidence-medium      muted amber
--confidence-low         muted red
--lead-new / contacted / qualified / converted / lost   (a 5-step muted sequence, not stoplight colors — this is a pipeline, not a pass/fail)
```

All semantic colors are deliberately **muted, not saturated** — a bright red "Failed" badge reads as alarming in an otherwise calm interface; a dusty red reads as informative. This is a case where the luxury aesthetic and good status-color practice happen to agree.

## 4. Foundation — Typography

- Loaded via `next/font` per hotel (never a generic system-font fallback visible to the guest — per [PRD](01-PRD-ai-concierge.md) tech stack, this is a Next.js app).
- Type scale (rem, 16px base): `0.75 / 0.875 / 1 / 1.125 / 1.5 / 2 / 2.5` — display sizes used sparingly (concierge name in the widget header, section headers in admin), body text sits at `1rem` with **1.6 line-height**, generous by SaaS standards, deliberate for a "calm, unhurried" read.
- Letter-spacing: display text in the Classic Luxury and Modern Luxury presets gets slight positive tracking (`+0.02em`) — a small, cheap signal of "considered typography" versus default browser rendering.
- Never justify guest-facing body text, never all-caps except short labels (button text, status badges) at small sizes with tracking.

## 5. Foundation — Spacing, Radius, Elevation

- **Spacing scale:** 4px base unit (`4/8/12/16/24/32/48/64`). Guest widget padding defaults to the generous end of this scale (16–24px) — cramped spacing is the single fastest tell of a bolted-on chat widget versus a considered interface.
- **Radius scale:** `--radius-sm: 8px` (buttons, inputs, badges), `--radius-md: 12px` (cards, message bubbles), `--radius-lg: 16px` (widget panel, modals) — soft enough to feel warm, never pill-shaped (`9999px`), which reads as consumer messaging-app styling rather than hospitality.
- **Elevation:** no heavy drop shadows. A single soft shadow token (`0 2px 12px rgba(0,0,0,0.06)`) for anything that needs to feel "lifted" (the widget panel over the page, a card over the thread) — gradients and multi-layer shadows are explicitly avoided as "clutter" per [UX §1](05-user-experience-flows.md).

## 6. Foundation — Motion

Every animation in the widget and admin portal draws from a fixed set of durations/easings — "restrained," per [UX §1](05-user-experience-flows.md), means literally constrained to this list, not a vibe:

| Token | Value | Used for |
|---|---|---|
| `--motion-micro` | 150ms ease-out | Button hover/press, chip selection |
| `--motion-standard` | 250ms ease-out | Message appearing, recommendation card entrance |
| `--motion-panel` | 350ms cubic-bezier(0.16, 1, 0.3, 1) | Widget opening, escalation panel appearing |
| `--motion-typing-pulse` | 1.5s ease-in-out infinite | Typing indicator — a soft breathing opacity pulse on a single dot/glyph, **not** three bouncing dots |

Streaming response text reveals token-by-token with no per-character animation (no typewriter sound-effect-style reveal) — the streaming *is* the animation; adding motion on top of it is the kind of "flashy AI effect" [UX §1](05-user-experience-flows.md) already ruled out.

## 7. Iconography

Lucide (per [PRD](01-PRD-ai-concierge.md) tech stack) — a single consistent icon set, line-weight matched to the type scale, never mixed with emoji in the interface chrome (emoji usage is a guest-facing *copy* decision per hotel, [ABS §2](02-ai-behavior-specification.md)'s `emojiAllowed` field — it's a voice choice, not a UI iconography choice).

## 8. Component Library — Guest Widget

| Component | Key visual rule |
|---|---|
| **Launcher** | Branded pill/button, appears after the 5–8s delay ([UX §2](05-user-experience-flows.md)); label text, not a bare icon-only bubble |
| **Widget shell** | Header (avatar + concierge name + hotel branding), scrollable thread, input bar, persistent CTA area ([UX §6](05-user-experience-flows.md)) |
| **Message — Concierge** | **No bubble.** Full-width text block, left-aligned, avatar shown once per turn — reads like a note from staff, not a chat-app speech balloon. This is the single biggest visual differentiator from a generic chatbot. |
| **Message — Guest** | Subtle bubble (`--radius-md`, `--neutral-100` background), right-aligned — the *only* place in the thread that looks like a conventional chat bubble, which is deliberate: it visually distinguishes "the guest speaking" from "the concierge speaking" without making the concierge look automated |
| **Recommendation Card** | Photo, name, one-line hook, `--brand-primary` accent border, `--radius-md` — per [UX §3](05-user-experience-flows.md), max one per turn, 2–3 in a horizontally-scrollable set for bundles |
| **Suggested-question / quick-start chips** | Outlined, `--radius-sm`, `--motion-micro` on tap — never filled/loud, they're a suggestion, not a primary action |
| **Yes/No confirmation** | Two buttons inline in the thread (primary + ghost), per [UX §4](05-user-experience-flows.md)'s lead-capture permission step |
| **Typing indicator** | Single pulsing glyph (`--motion-typing-pulse`), not three dots |
| **Escalation/Handoff panel** | Distinct card treatment (subtle border, no accent color — deliberately calmer than a recommendation card, since [UX §5](05-user-experience-flows.md) requires it to read as "we're taking this seriously," not "here's another option") |

## 9. Component Library — Admin Portal

| Component | Key visual rule |
|---|---|
| **Sidebar nav** | Matches [UX §8](05-user-experience-flows.md)'s screen map exactly — Dashboard, Hotels, Knowledge Base, Conversations, Leads, Analytics, Brand Settings, Prompt Settings, Integrations, Billing, Users |
| **KPI tile** | Large number, small label, no sparkline clutter — the [Dashboard at a Glance](05-user-experience-flows.md) tiles are meant to be read in under a second |
| **Status badge** | Directly maps to the enums in [DB Design](07-database-design.md) — `DocumentStatus`, `LeadStatus`, `ConfidenceBand` — one component, driven by a semantic-token lookup (§3), not one-off colors per screen |
| **Data table** | Documents / Conversations / Leads lists — row-level status badges, sortable by the indexed columns already defined in [DB Design §12](07-database-design.md) (so the UI's "sort by" options are never a lie about what's actually fast to query) |
| **Upload dropzone** | Drag target + per-document progress using the plain-language labels from [UX §9](05-user-experience-flows.md) ("Reading…" → "Chunking…" → "Embedding…" → "Ready") |
| **Relationship Bundle builder** | Split view: edit form + live guest-facing preview pane rendering actual Recommendation Cards (§8 above) — per [UX §10](05-user-experience-flows.md), this is the one screen that most directly needs to look like the guest widget, not like admin chrome |
| **Brand editor** | Color/font/logo controls on one side, a live widget preview on the other — changes apply to the preview instantly (same runtime CSS-variable mechanism as §1) |
| **Conversation thread viewer** | Reuses the guest widget's message components (§8) read-only, with the QA Rubric scoring widget ([ABS §15](02-ai-behavior-specification.md)) docked alongside, not overlaid |
| **Charts** | Recharts (per [PRD](01-PRD-ai-concierge.md) tech stack), muted semantic-token palette (§3) — no default chart-library rainbow palette |

## 10. Dark Mode & Accessibility

- **Admin portal supports dark mode** — an ops/analytics tool used for extended sessions benefits from it; token architecture (§1) makes this a second value set behind the same variable names, not a separate stylesheet.
- **Guest widget follows the hotel's light brand by default** (luxury hospitality sites are overwhelmingly light-themed) but must not break if a guest's system is set to dark — token remapping degrades gracefully rather than the widget being hardcoded light-only.
- **WCAG AA minimum** ([PRD §17](01-PRD-ai-concierge.md)): every brand-color/neutral-background combination is contrast-checked before a hotel's theme goes live (part of the Brand Settings save flow, not a manual audit) — a hotel's brand color is never allowed to render text below AA contrast against its paired background.
- Minimum 44px touch targets throughout the guest widget (mobile-first per [UX §1](05-user-experience-flows.md)).
- Every icon-only control has an accessible label; the widget is screen-reader operable end to end, not just visually usable.

## 11. Responsive Breakpoints

Matches [UX §1](05-user-experience-flows.md)'s mobile-first mandate exactly:

| Breakpoint | Widget behavior |
|---|---|
| Mobile (< 768px) | Full-screen takeover on open — no floating box |
| Tablet (768–1024px) | Large anchored panel, not full-screen, not the small desktop corner widget |
| Desktop (> 1024px) | Corner-anchored panel, max-width ~400px |

## 12. Implementation Notes

- **Tailwind config** extends the default theme with the token names in §3–§6 as CSS-variable-backed values, not static hex/px — this is what makes runtime per-hotel theming (§1) possible without a rebuild per tenant.
- **shadcn/ui** provides the primitive layer (Button, Dialog, Input, Badge, Card) — used as a foundation and re-skinned via the tokens above, not left in its default zinc/slate theme (a default-shadcn-look admin panel is a fast way to look like every other AI-wrapper product shipped in the last two years).
- **Framer Motion** implements §6's motion tokens directly — panel enter/exit, message entrance, the typing pulse — nothing beyond what's specified there.

## 13. Do / Don't Reference

| Do | Don't |
|---|---|
| Warm off-white / near-black neutrals | Pure `#FFFFFF` / `#000000` |
| Brand color as accent (border, CTA, avatar ring) | Brand color as a full-bleed background |
| No bubble for concierge messages | Symmetric bubbles for both sides (reads as generic chat) |
| Single pulsing typing indicator | Three bouncing dots |
| One recommendation card per turn | A grid/list of many options at once |
| Muted semantic status colors | Stoplight-bright red/green/amber |
| 5–8s delayed, labeled launcher | Instant "Chat with us" bubble |

---

**Next document:** [API Specification](09-api-specification.md) — the concrete request/response contracts for every endpoint named in the [System Architecture Blueprint](06-system-architecture.md), and the component props/data shapes this design system's components actually need to render.
