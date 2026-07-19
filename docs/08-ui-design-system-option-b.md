# UI Design System — Option B (Platform-Native)

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0 — alternate direction, decision pending
**Companions:** [Option A — Heritage Concierge](08-ui-design-system.md) · [Option C — The Night Concierge](08-ui-design-system-option-c.md) · [Option D — The Grammar of Service](08-ui-design-system-option-d.md)

This is a second, genuinely different visual direction for the same product, kept alongside Option A rather than merged into it — the two represent different bets on what "premium" means here, and that's worth seeing side by side (and as [live artifacts](#)) before committing. Nothing below has been softened or argued against; it's recorded faithfully so the comparison is fair.

---

## 1. Design Principles

Communicate: Luxury, Trust, Calm, Simplicity, Intelligence. Explicitly not: AI, Technology, Complexity — the AI should disappear behind the experience.

**Brand personality:** Apple × Aman Resorts × Rosewood × Notion × Linear. Keywords: minimal, spacious, elegant, soft, premium, warm, timeless.

**Where this differs from Option A:** Option A pursues "premium" through specificity — an unusual, chosen palette (bottle-green, not a default), an old-style serif with real character, a structural rule (no bubble for the concierge) that's specific to hospitality. Option B pursues "premium" through restraint and familiarity — a fixed, safe platform palette, a proven system typeface (Geist/Inter), and a dashboard layout modeled directly on Linear. Both are legitimate premium strategies; they just bet on different things reading as trustworthy.

## 2. Color System — Two Layers

**Platform colors (fixed, define the product regardless of hotel):**

| Token | Color | Purpose |
|---|---|---|
| Background | `#FAFAF8` | Warm white |
| Surface | `#FFFFFF` | Cards |
| Surface Secondary | `#F5F5F3` | Panels |
| Border | `#E7E5E4` | Subtle separators |
| Text Primary | `#1F2937` | Main content |
| Text Secondary | `#6B7280` | Supporting text |
| Success | `#16A34A` | Positive feedback |
| Warning | `#F59E0B` | Notices |
| Error | `#DC2626` | Errors |

**Hotel brand colors (dynamic override):** each hotel sets Primary / Secondary / Accent — e.g. Bellevue → navy, Rosewood → burgundy, Aman → sand. Same mechanism as Option A (`BrandSettings`-driven), different palette philosophy: Option A treats the platform's own neutrals as bespoke (a chosen limestone/ink pair); Option B treats them as a fixed, generic-safe base that every hotel's accent sits on top of unchanged.

## 3. Typography

**Geist (or Inter).** Chosen for being clean, modern, highly readable, free, and well-supported in Next.js — a deliberately safe, proven choice rather than a distinctive pairing.

| Element | Size |
|---|---|
| Display | 48px |
| H1 | 36px |
| H2 | 30px |
| H3 | 24px |
| H4 | 20px |
| Body | 16px |
| Small | 14px |
| Caption | 12px |

## 4. Spacing, Radius, Shadows

- **8px grid:** `4 / 8 / 16 / 24 / 32 / 40 / 48 / 64 / 80 / 96`.
- **Radius:** Small 8px · Medium 12px · Large 16px · XL 24px — "avoid excessive rounding, luxury feels refined not playful."
- **Shadows — three elevations only:** Card (soft), Modal (medium), Floating Widget (large). Never stack multiple shadows.

## 5. Core Components

- **Buttons:** Primary (filled, hotel primary color) · Secondary (outlined) · Ghost (text only).
- **Inputs:** Large, comfortable, minimal borders — no floating labels.
- **Cards:** Generous padding, minimal borders, soft shadow.
- **Icons:** Lucide, consistent set, no mixing.
- **Motion:** Chat opens with fade + slide (200–250ms) · typing indicator is three soft dots · messages fade upward on arrival (150ms) · dashboard loading uses skeletons, never spinners where avoidable.

## 6. Chat Widget

```
┌───────────────────────────────┐
│ Bellevue Hotel                │
│ Digital Concierge             │
│───────────────────────────────│
│                               │
│ Welcome...                    │
│                               │
│ ○ Family Holiday              │
│ ○ Romantic Escape             │
│ ○ Spa Day                     │
│ ○ Business Trip               │
│                               │
│───────────────────────────────│
│ Ask me anything...            │
└───────────────────────────────┘
```

Standard bubble-based message thread (both sides), three-dot typing indicator.

## 7. The Signature Experience — Experience Cards

Instead of opening to a blank thread, the widget opens with emoji-labeled experience cards, each starting a guided, pre-scoped conversation:

```
✨ Plan a Romantic Escape
👨‍👩‍👧 Family Holiday
💼 Business Stay
💍 Wedding Planning
🧖 Spa & Wellness
📍 Explore the Local Area
```

**Relationship to Option A's quick-start selector** ([UX §2](05-user-experience-flows.md)): this is the same underlying mechanism — tapping a card sets a `persona`/`context_tag` in one turn — rendered with emoji-and-label cards instead of text chips. Functionally identical; visually much bolder.

## 8. Dashboard

**Layout, "very Linear-like":** Sidebar → Header → Stats → Insights → Tables → Actions.

**Sidebar** (icons + labels, no nested menus initially): Dashboard · Hotels · Knowledge · Conversations · Leads · Analytics · Branding · Users · Settings.

**Dashboard cards:** one number, one trend, nothing else —
```
Today's Leads
24
↑ 18%
```

**Analytics as insight cards, not raw graphs:**
```
Most Asked Question
Airport Transfer
Recommendation
Upload transfer pricing.
```
(Same "insights, not charts" idea already in [UX §12](05-user-experience-flows.md) — consistent with Option A here.)

**Empty states:** never blank —
```
No conversations yet.
Upload your first knowledge document
to activate the concierge.
[Upload]
```

**Loading states:** skeletons, never flashing layouts. **Notifications:** unobtrusive toasts, top-right, auto-dismiss.

## 9. Responsive & Accessibility

Mobile / Tablet / Laptop / Desktop — "the concierge should feel native on mobile, not like a shrunk desktop widget" (same principle as [UX §1](05-user-experience-flows.md)). WCAG AA contrast, keyboard navigation, focus indicators, screen reader labels, reduced-motion support.

## 10. Component Library (V1)

**Foundation:** Button · Input · Textarea · Select · Checkbox · Switch · Badge · Avatar · Tooltip · Modal
**Layout:** Card · Sidebar · Header · Breadcrumb · Tabs · Drawer
**AI:** Chat Bubble · Typing Indicator · Suggested Question Chips · AI Response Card · Recommendation Card · Lead Capture Form · Confidence Badge (admin only)
**Dashboard:** KPI Card · Chart Card · Activity Feed · Conversation Table · Document List · Analytics Insight Card

## 11. Dark Mode — Deferred

**Not for V1.** Reasoning given: hotel staff primarily use the dashboard during business hours, and supporting both themes doubles design/testing effort — revisit once the product matures.

---

## 12. Comparison at a Glance (Option A vs. Option B)

| | Option A — Heritage Concierge | Option B — Platform-Native |
|---|---|---|
| Neutral palette | Chosen (limestone/ink, bottle-green accent) | Fixed generic-safe (`#FAFAF8`/`#1F2937`) |
| Typography | Iowan Old Style + Optima (distinctive) | Geist/Inter (safe, proven) |
| Concierge message style | No bubble — reads as staff | Bubble on both sides — reads as chat |
| Typing indicator | Single pulsing dot | Three soft dots |
| Opening affordance | Text chips (suggested questions + quick-start) | Emoji-labeled experience cards |
| Dashboard model | Custom KPI tiles | Explicitly "Linear-like" |
| Dark mode | Admin portal yes, widget graceful | Deferred entirely, V1 |
| Risk profile | More distinctive, more design/build effort | Faster to build, closer to "another AI dashboard" |

Neither comparison row is a verdict — this table exists so the choice (or a deliberate mix, e.g. Option B's dashboard/component list scaffolding with Option A's color/type/no-bubble treatment) can be made deliberately later rather than by default.

---

**See also:** [Option A — Heritage Concierge](08-ui-design-system.md)
