# UI Design System — Option C (The Night Concierge)

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Version:** 1.0 — third direction, decision pending
**Companions:** [Option A — Heritage Concierge](08-ui-design-system.md) · [Option B — Platform-Native](08-ui-design-system-option-b.md) · [Option D — The Grammar of Service](08-ui-design-system-option-d.md)

Options A and B both assume the concierge lives in daylight — A on limestone stationery, B on SaaS white. This direction starts from a different observation: **the hours when a digital concierge earns its keep are the hours when the human one has gone home.** A guest planning a honeymoon at 11pm, a jet-lagged arrival asking about breakfast at 5am. Option C designs for that moment — the lobby at midnight, lamplight on dark wood — and turns it into the product's signature feature rather than just a mood.

---

## 1. Concept & Vernacular

The system is named in hotel language, not software language:

| Software term | This system calls it | Why |
|---|---|---|
| Guest widget | **Front of House** | What the guest experiences |
| Admin portal | **Back of House** | Where staff work — every hotelier knows the term instantly |
| Daily metrics rollup (`DailyMetric`, [DB §13](07-database-design.md)) | **The Night Audit** | The real hotel ritual of reconciling the day's numbers after midnight — our daily rollup *is* a night audit |
| Conversation transcript review | **The Ledger** | Read, annotated, signed off |

This isn't decoration — it's the same principle as the ABS's "staff, not software" persona rule, applied to the interface's own naming. When Adam sees "Night Audit" on the analytics screen, he knows this was built by people who understand hotels.

## 2. The Signature Feature — Time-Aware Theming

The widget's palette follows the guest's local clock: **Daybreak** (warm parchment, bronze accent) through **Nocturne** (midnight blue-black, candle-gold accent), interpolating gently through the day. The greeting shifts with it — "Good morning" → "Good evening" → "The night concierge is at your service."

- **Why it's more than a gimmick:** luxury hotel photography is shot at dusk for a reason — warmth against dark reads as intimacy and service. A widget that meets an 11pm guest in candlelight, instead of blasting them with a white panel, is hospitality expressed in CSS.
- **Implementation is nearly free:** the token architecture from Option A (runtime CSS custom properties per hotel) already supports it — time-awareness is one more input to the same token resolution, a `BrandSettings` toggle (`timeAwareTheme: boolean`) per hotel, defaulting on.
- **Fixed structure still rules:** spacing, motion, component shape never change with the hour. Only the token values glide.

## 3. Color — Two Poles, One Dial

**Nocturne (the committed primary — this is the design's home):**

```
--ground      #101319   midnight blue-black — never pure #000
--panel       #171C26   raised surfaces
--text        #EAE5D9   candlelit warm white
--muted       #8F8B80   secondary text
--accent      #C9A96B   candle gold — CTA, avatar glow, hairlines
--line        #262C38   borders, ledger rules
```

**Daybreak (the dawn pole of the same dial):**

```
--ground      #EFEBE2   parchment
--panel       #E7E2D6
--text        #23262E
--muted       #6E6A5F
--accent      #8A6C3C   bronze — same gold family, deepened for light ground
--line        #D8D2C4
```

**Status colors (fixed, tuned for dark first):** sage `#7FA98B` (indexed/positive) · amber `#C99C5C` (needs review) · rust `#C07A66` (failed/escalation). Muted like ledger annotations, never stoplight-bright.

**The one rule:** gold is spent like candlelight — hairlines, the avatar's glow, one CTA. A full gold panel would turn "private bar at midnight" into "casino." Restraint is the whole trick.

## 4. Typography — The Monogram Voice

| Role | Face | Character |
|---|---|---|
| Display | Didone (Didot / Bodoni; license a proper cut — e.g. Playfair Display via `next/font` — for the build) | High-contrast hairline serifs — hotel monograms, menu covers, champagne labels. Deliberately *not* Option A's bookish old-style serif; this is the engraved voice, not the library voice. |
| Body | Avenir Next / geometric-humanist sans | Quietly modern against the didone's drama |
| Utility | Mono, `tabular-nums` | The Night Audit's figures — audit slips demand aligned digits |

Didones are display faces — **never below 20px**, generous size, tight tracking at large sizes. Body text never set in the didone. Small-caps labels with wide tracking (`+0.08em`) do the wayfinding.

## 5. Motion — Candlelight, Not Electricity

Slower than both A and B, and that's deliberate — nothing about midnight hurries:

| Token | Value | Used for |
|---|---|---|
| `--motion-standard` | 400ms ease-out | Messages, cards |
| `--motion-panel` | 600ms cubic-bezier(0.16, 1, 0.3, 1) | Widget open, dusk transitions |
| `--motion-breathe` | 3s ease-in-out alternate | The avatar's candle-glow, the typing ember |

Typing indicator: a single **ember** — a small gold dot whose glow breathes. Not three dots (B), not a pulse on neutral (A) — a point of warm light in the dark, which is the entire design in one 8px circle.

## 6. Components — Front of House

- **Concierge turns as stationery:** no bubble (shares A's conviction), but with C's own mark — a short gold hairline rule and a small-caps "THE CONCIERGE" label above each turn, like letterhead. Guest turns get a dim panel and "YOU" label — correspondence, not chat.
- **Recommendation card:** gold hairline frame around the photo, didone title, one-line hook — a gallery plate, framed like the evening's suggestion ("One for this evening —").
- **Avatar:** circular, with a soft radial candle-glow (`box-shadow`, breathing at `--motion-breathe`). Lamplight, not a status LED.
- **Launcher:** appears after the 5–8s delay (per [UX §2](05-user-experience-flows.md)) with the time-aware greeting as its label.

## 7. Components — Back of House

- **The Night Audit:** the daily KPI view styled as a printed audit slip — small-caps headers, dotted leaders (the menu/ledger idiom), `tabular-nums` figures, hairline rules. One glance, like the night manager's 2am printout.
- **The Ledger (conversation review):** transcript in the Front of House stationery style, read-only, QA scoring docked beside it as marginalia.
- **Status annotations:** colored dot + small-caps text (`● INDEXED`), never filled badges — annotations on a ledger, not stickers on a dashboard.
- Back of House runs Nocturne permanently — staff tools don't need the dusk dial, and dark suits long evening shifts. (Directly opposes B's "defer dark mode"; C inverts it: dark *is* the mode.)

## 8. Theme Behavior & Accessibility

- The design **commits to its world**: the marketing/specimen surfaces are Nocturne regardless of OS theme — a deliberate single-world choice, like a letterpress invitation. The *guest widget* is the surface that moves, via the dusk dial, not the OS toggle.
- Both poles are contrast-checked to WCAG AA — `#EAE5D9` on `#101319` and `#23262E` on `#EFEBE2` both clear it comfortably; the interpolated midpoints are validated at build time across the dial's range, not assumed.
- `prefers-reduced-motion`: the glow stops breathing, dusk transitions become instant steps. 44px touch targets, full keyboard operability, same as A.

## 9. Three Directions, One Product

| | A — Heritage | B — Platform-Native | C — Night Concierge |
|---|---|---|---|
| The bet | Specificity reads as premium | Familiarity reads as trustworthy | Atmosphere reads as service |
| Ground | Limestone (light) | White (light) | Midnight (dark, time-aware) |
| Display face | Old-style serif (library) | Geist/Inter (neutral) | Didone (engraved) |
| Concierge turn | No bubble | Bubble | No bubble + letterhead rule |
| Typing | Pulsing dot | Three dots | Breathing ember |
| Signature idea | Token-themed per hotel | Emoji experience cards | Dusk dial — theme follows the guest's clock |
| Risk | Effort | Genericness | Dark-first boldness |

A mix remains legitimate — e.g. C's time-aware theming is architecturally just another token input, so it could ride on A's or B's daytime look and only come alive after sunset. That might be the strongest play of all: **any base direction, with C's dusk behavior as the demo moment that makes Adam lean forward.**

---

**See also:** [Option A](08-ui-design-system.md) · [Option B](08-ui-design-system-option-b.md)
