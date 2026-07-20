# Demo Property: Bellevue Hotel

**Product:** Hospitality AI OS
**Module:** AI Concierge
**Depends on:** [Sales Demo Script](13-sales-demo-script.md) · [Information Architecture](03-information-architecture.md) · [Sprint Backlog](14-sprint-backlog.md)

The actual content for the fictional demo property named throughout every prior document. Two uses, same facts: **(1)** copy for the `apps/demo-bellevue` marketing site (Sprint 5), and **(2)** structured source material for real knowledge-base ingestion testing (Sprint 2) — matching the [IA §3](03-information-architecture.md) entity model exactly, so this doubles as realistic test data instead of hand-waved placeholders.

Tone preset: **Classic Luxury** ([ABS §2](02-ai-behavior-specification.md) / [UI Design System Option A](08-ui-design-system.md)).

---

## 1. Site Architecture — Two Deliverables

| Deliverable | What it is | Shown to Adam? |
|---|---|---|
| `apps/demo-bellevue` | New app in the monorepo — the hotel site itself, widget embedded via a real `<script>` tag pointed at a widget key, exactly how a real hotel would integrate it | **Yes** — this is the Sales Demo Script's live demo |
| Devsphinx product landing page | Separate marketing page for "Hospitality AI OS" as a capability/portfolio piece — for broader outreach, not this meeting | No — [Sales Demo Script §1](13-sales-demo-script.md) is explicit that platform framing isn't said in the room |

**New Sprint Backlog item this surfaces:** the embeddable widget script (a bundled entry point a third-party page loads via `<script src=".../widget.js" data-widget-key="...">`, mounting itself into the page) has never been named as a build target before — everything prior treated "the widget" as a React component living inside our own app. Added to Sprint 3/5 below.

## 2. Property Profile (singleton — the "quick facts" injected unconditionally, [DB §6](07-database-design.md))

```
name: Bellevue Hotel
starRating: 5
checkInTime: 3:00 PM
checkOutTime: 11:00 AM
petFriendly: true
airportDistanceNote: 25 minutes from Bellevue Regional Airport
quickFactAmenities: [Spa, Infinity Pool, Kids' Club, Fitness Center]
location: Oceanfront, Bellevue Cove
brandStory: Since 1968, Bellevue Hotel has stood at the edge of Bellevue Cove as
  the coastline's quiet constant — a five-star retreat built around unhurried
  service and a view that hasn't needed to change in fifty years.
```

## 3. Room Types (`/rooms`)

| Name | View | Capacity | Beds | Accessible | Rate (per night) |
|---|---|---|---|---|---|
| Garden Room | Garden | 2 | 1 king or 2 twin | No | $450–550 |
| Garden Room, Accessible | Garden | 2 | 1 king, roll-in shower | **Yes** | $450–550 |
| Ocean View Suite | Ocean, private balcony | 2–3 | 1 king + daybed | No | $750–950 |
| Family Suite | Garden | 4–5 | 2 queen + sofa bed, connects to Garden Room | No | $650–800 |
| Presidential Suite | Full ocean, corner | 4 | 1 king + living area | No | $1,800–2,400 |

*(The accessible Garden Room exists specifically because [Playbook #16](04-conversation-playbook.md) tests exactly this question — real coverage, not a hypothetical.)*

## 4. Dining (`/dining`)

**The Rooftop at Bellevue** — coastal Mediterranean, dinner only (6–10 PM), smart casual, reservations recommended. Dietary tags: vegetarian, vegan, gluten-free available on request.

**Palm Terrace** — all-day dining (breakfast 7–10:30 AM, lunch, dinner), casual, family-friendly, dedicated kids' menu.

## 5. Spa & Wellness (`/spa`)

| Treatment | Duration | Price | Facility |
|---|---|---|---|
| Deep Tissue Massage | 60 / 90 min | $180 / $240 | Bellevue Spa & Wellness Center |
| Couples Massage | 60 min | $420 (pair) | Spa |
| Prenatal Massage | 60 min | $190 | Spa — *suitability confirmed with spa staff, per [ABS §9](02-ai-behavior-specification.md)'s medical-deferral rule* |
| Ocean Facial | 45 min | $150 | Spa |
| Hot Stone Therapy | 75 min | $210 | Spa |

## 6. Weddings & Events (`/weddings`)

**The Grand Pavilion** — oceanfront ballroom, seats 200, full AV (sound/lighting/projection), catering minimum $15,000.

**Sunset Terrace** — outdoor ceremony space, capacity 120, catering minimum $8,000.

## 7. Experiences

| Name | Category | Duration | Price | Lead time |
|---|---|---|---|---|
| Sunset Sailing Charter | Off-site | 2 hrs | $350/couple | 24 hrs |
| Kids' Club Adventure Day | On-site | Half-day | $85/child (ages 4–12) | Same day |
| Private Beach Cabana | On-site | Full day | $250 | 48 hrs |

## 8. Local Recommendations (`/explore`)

- **Harbor Row Sushi** — dining, 10 min drive — "the hotel's own pick for a special dinner out"
- **Cliffside Coastal Trail** — outdoors, 5 min walk — "the best sunrise view in Bellevue Cove"
- **The Vintage District** — shopping, 15 min drive — boutique galleries and wine bars
- **Marina Farmers Market** — Saturdays only — "guests love the fresh oyster stand"

## 9. Policies

| Topic | Rule |
|---|---|
| Check-in / check-out | 3:00 PM / 11:00 AM. Early check-in subject to availability, not guaranteed. |
| Pets | Welcome in select rooms. $75/night fee. Breed restrictions may apply. |
| Cancellation | Free up to 48 hours before arrival; one night charged after that. |
| Smoking | Non-smoking property. Designated outdoor areas only. $250 cleaning fee if violated. |
| Parking | Valet $45/night. Self-park $30/night. |
| Extra guest | $50/night for a third guest in applicable room types. |

## 10. Relationship Bundles ([IA §12](03-information-architecture.md) — curated, not inferred)

| Context tag | Bundle |
|---|---|
| `anniversary` | Ocean View Suite → The Rooftop dinner → Couples Massage |
| `honeymoon` | Presidential Suite → The Rooftop private dinner → Couples Massage → Sunset Sailing Charter |
| `family` | Family Suite → Kids' Club Adventure Day → Palm Terrace dining |

These three map directly to Playbook G-05 (anniversary), G-15 (honeymoon), and the family bundle in G-16 — this content isn't just site copy, it's what makes those scenarios pass against real data instead of hand-entered stand-ins.

## 11. Photography — Sourcing Plan

Free licensed stock (Unsplash/Pexels), not AI-generated — real photography reads as more convincing for a luxury-hospitality first impression. Search terms per page, to pull during the actual build (Sprint 5):

- Home hero: "luxury oceanfront hotel exterior," "hotel infinity pool sunset"
- Rooms: "luxury hotel suite ocean view," "hotel bedroom king bed minimal"
- Dining: "fine dining restaurant interior," "rooftop restaurant ocean view"
- Spa: "spa treatment room luxury," "hot stone massage spa"
- Weddings: "oceanfront wedding ballroom," "outdoor wedding ceremony beach"
- Explore: "coastal town street," "farmers market seaside"

## 12. What Still Needs Building (tracked in Sprint Backlog)

- [x] Scaffold `apps/demo-bellevue` (built ahead of sequence — homepage + subpages, per [Creative Direction](18-demo-bellevue-creative-direction.md) / [UX Blueprint](19-demo-bellevue-ux-blueprint.md))
- [ ] Build the embeddable widget script (new build target — bundled entry point, `<script>`-tag mountable, not just a React component internal to `apps/web`). `apps/demo-bellevue`'s `ConciergeWidget.tsx` is a visual-placement stub, not this.
- [ ] Author this content as actual PDF/DOCX/TXT source files for real ingestion testing (Sprint 2), not just this markdown table
- [x] Source and add photography per §11 — hotlinked verified Unsplash IDs in `apps/demo-bellevue/src/lib/images.ts`, not yet downloaded as owned project assets
- [ ] Wire the widget embed once Sprint 1 (chat pipeline) and the embed script both exist
- [ ] Write real testimonial quotes into this doc — three were authored directly in `apps/demo-bellevue/src/lib/content.ts` as a stopgap (flagged in [UX Blueprint §8](19-demo-bellevue-ux-blueprint.md)) and should move here once approved

---

**Next:** the Devsphinx product landing page — separate, lower-priority planning session, not blocking the Adam demo.
