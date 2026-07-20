# UX Blueprint — Bellevue Hotel

**Product:** Hospitality AI OS · **Deliverable:** `apps/demo-bellevue` (Sprint 5)
**Depends on:** [Demo Property Content](16-demo-property-content.md) · [Creative Direction](18-demo-bellevue-creative-direction.md) · [Sales Demo Script](13-sales-demo-script.md) · [UX Flows](05-user-experience-flows.md)
**This is UX architecture, not implementation.** Structure, hierarchy, storytelling flow, and interaction intent — detailed enough that a designer/developer can build without making major structural decisions. No code, no visual design beyond what the [Creative Direction](18-demo-bellevue-creative-direction.md) already fixes. Every fact referenced here (rooms, rates, hours, distances) comes from [docs/16](16-demo-property-content.md) — nothing invented.

---

## 1. Architecture Overview

### 1.1 Sitemap

```
Home (/)              — the storytelling spine; this document's main subject
├── /rooms            — all 5 room types, full detail + rates
├── /dining           — The Rooftop at Bellevue + Palm Terrace, hours, menus
├── /spa              — full treatment menu + facility
├── /explore          — experiences + local recommendations
├── /weddings         — The Grand Pavilion + Sunset Terrace (secondary audience — quiet doorway, not in main nav flow priority)
└── Reserve           — booking inquiry (modal-or-page decision left to build; behavior specified in §6)
```

**Why homepage-as-spine + subpages, not one long page:** the [content doc](16-demo-property-content.md) already routes content this way, and it matches how luxury-hotel visitors actually behave — an emotional first visit (homepage, mobile, often from a shared link) followed by a task-driven return visit ("what exactly does the Family Suite cost?"). The homepage sells the *feeling* and curates; subpages carry the *facts* in full. Nothing critical is homepage-only or subpage-only: every homepage section ends in a doorway to its subpage.

### 1.2 Persistent elements (all pages)

- **Header:** wordmark left; nav right — Rooms · Dining · Spa · Explore · **Reserve**. Transparent over the hero, gaining a warm paper background + hairline once scrolled (same "firms up only when needed" behavior as the Creative Direction's discreet-wayfinding principle). Weddings lives in the footer, not the header — different audience, different journey; it must not dilute the guest-booking path.
- **Reserve** is the only emphasized nav item (the single brass-accented element in the header) and is reachable from every scroll position on every page. This is the site's one persistent conversion path — because it's always present, no section below ever needs to shout.
- **AI Concierge widget** — see §7. Bottom-right labeled launcher, appearing after the 5–8 s delay the product specifies. It is a persistent element of this architecture, not an add-on.
- **No announcement/seasonal banner.** Rejected deliberately: a banner is the single fastest way to break "the world got quieter" ([CD §1](18-demo-bellevue-creative-direction.md)). If a seasonal note is ever genuinely needed, it renders as one quiet small-caps line *inside* the intro section — content, not chrome.

### 1.3 Homepage section order

The order implements the Creative Direction's narrative arc (*noise → stillness → trust → longing → surrender → possibility → reassurance → resolve*) — deliberately reordered from the conventional template in three ways:

1. **Introduction before rooms** — heritage earns the right to sell. Trust before want.
2. **Gallery late, not early** — it's the wordless *remembrance* beat after desire is built, not a decorative slideshow before it.
3. **No awards wall, no separate amenities grid, no FAQ accordion.** Recognition is one line of standing inside the Introduction (est. 1968 · five stars — both real facts). Amenities surface inside the sections they belong to (pool in Gallery/Experiences, Kids' Club in Experiences) rather than as an icon grid — icon grids are the "generic SaaS" of hotel sites. Practical questions (policies, parking, pets) are handled by the **Practical Notes** micro-section (§5.10) + the concierge widget — which is both better UX and the product demo working as intended.

```
 1. Hero               — the horizon           (stillness)
 2. Introduction       — the premise           (trust)
 3. Rooms              — the private world     (longing)
 4. Dining             — the table             (warmth)
 5. Spa                — surrender             (deepest calm)
 6. Experiences        — the days              (possibility)
 7. Gallery            — remembrance           (immersion)
 8. Testimonials       — the proof             (reassurance)
 9. Location           — the map               (grounding)
10. Practical notes    — the desk              (confidence)
11. Booking invitation — the return            (resolve)
12. Footer             — the farewell          (composed close)
```

### 1.4 Visual rhythm map — never the same beat twice in a row

Alternating registers so no two consecutive sections share a rhythm (the "avoid repeating visual rhythm" requirement, made explicit and checkable):

| # | Section | Register | Dominant element |
|---|---|---|---|
| 1 | Hero | Full-bleed image, light | One photograph |
| 2 | Introduction | Paper, text-led | Large serif passage |
| 3 | Rooms | Editorial image+text alternation | Offset image cards |
| 4 | Dining | **Warmest/darkest register** — dusk gold | Full-bleed dusk photograph |
| 5 | Spa | **Palest, most spacious** | One image, maximum whitespace |
| 6 | Experiences | Structured, slightly denser | Three-item editorial row |
| 7 | Gallery | Full-bleed wordless sequence | Photography only |
| 8 | Testimonials | Paper, text-led, intimate | One quote at a time |
| 9 | Location | Factual, grounded | Map/coast imagery + facts |
| 10 | Practical notes | Smallest, quietest | Fine-print elegance |
| 11 | Booking invitation | Full-bleed horizon reprise | The hero's view, at dusk |
| 12 | Footer | Ink (darkest paper) | Ordered typography |

The page's tonal shape: light → warm → palest → immersive → grounded → dusk. The Booking Invitation deliberately **reprises the hero's horizon at a later hour** — the bookend that makes the page feel composed rather than assembled.

---

## 2. The Hero — full specification

**Purpose.** Deliver the brand's entire promise (permanence, calm, the unchanging view) as a *feeling* in under three seconds, before a single fact is read. Lower the visitor's pulse.

**Messaging hierarchy (exactly three levels, nothing else):**
1. **The name** — "Bellevue Hotel" in the heritage display serif. The largest type on the site.
2. **One line** — drawn from the brand story, e.g. *"The coastline's quiet constant, since 1968."* One line only; it must fit on a single line even on mid-size screens.
3. **One quiet locator** — small caps: *Oceanfront · Bellevue Cove*. This is supporting information, set at whisper volume.

No paragraph. No feature list. No "Welcome to." The hero says *who*, *one line of why*, *where* — and stops.

**Visual composition.** One full-viewport photograph: the sea, with the **horizon line sitting low in the frame** so the sky's calm occupies most of the composition and gives the name room to breathe. The name sits in the sky's quiet zone, never across the horizon (the horizon is sacred — [CD principle 12](18-demo-bellevue-creative-direction.md)). Nothing else competes: no badge, no carousel, no video controls, no down-arrow icon cluster.

**Booking CTA placement.** *Not in the hero body.* The persistent **Reserve** in the header is intentionally the hero's only booking path. Rationale: a hero-level "BOOK NOW" is the loudest possible opening move and contradicts the entire brand ("the site never appears to need the booking"). Reserve is visible in the corner of the same viewport — present, discoverable in under a second, silent.

**Supporting information.** The single small-caps locator line above; nothing more. Star rating, amenities, and dates all have better homes below.

**First-scroll experience.** The most designed moment on the page: as the visitor first scrolls, the hero photograph holds briefly and settles (the slow tide-like drift the Creative Direction specifies), and the Introduction's first serif line **emerges from below the horizon** — the story literally begins beneath the view. A fine brass hairline (the horizon motif) draws in as the section boundary. One scroll should produce the sensation: *the image was a held breath; the text is the exhale.*

**Emotional impact target.** Stillness and quiet awe. A test the build must pass: show the hero for five seconds to someone cold — they should describe a *feeling* ("calm," "expensive," "I want to be there") rather than recite information. If they recite information, the hero has too much of it.

**Mobile.** Full-viewport portrait crop of the same sea image (art-directed crop, not a center-crop of the landscape original — the horizon must stay low). Name may break to two lines; locator stays one. Reserve remains in the compact header. The first-scroll moment is preserved — it's *more* important on mobile, where the first impression usually happens.

---

## 3. Section-by-section blueprint

Format per section — **P** purpose · **UG** user goal · **BG** business goal · **CP** content priority (ordered) · **L** layout recommendation · **VH** visual hierarchy · **IO** interaction opportunities · **T** transition to next section · **UX** rationale, including *think / feel / do* and how it visually differs from the previous section.

### 3.1 Introduction — *the premise*

- **P:** Establish standing and earn trust before anything is sold. This is the "who we are" that makes the rooms below feel inevitable rather than pitched.
- **UG:** "Is this place serious? What kind of hotel is this?"
- **BG:** Differentiation — plant *permanence* (the positioning no competitor copies) in the first 30 seconds; carry the site's only recognition moment (est. 1968 · five stars) without an awards wall.
- **CP:** ① The brand-story passage (the "quiet constant" text, lightly edited for the page) ② one line of standing: *Est. 1968 · Five stars* in small caps ③ a single supporting photograph (the property at a distance — the hotel *in* its coastline).
- **L:** Text-led on warm paper. A narrow, generous reading measure; the passage set large in the display serif — read as an *inscription*, not a paragraph. The photograph offset to one side, breaking the margin, editorially captioned (*The cove, morning*).
- **VH:** Serif passage → standing line → photograph → caption.
- **IO:** Minimal by design — this section's interaction is *reading*. At most, a quiet text link: *Our story* (if a story page ever exists; otherwise none).
- **T:** The passage's final line pivots from place to visitor — from "it hasn't changed" toward "your room is waiting" — and the first Rooms image begins at the fold's edge, pulling the scroll.
- **UX:** *Think:* "This place has been here fifty years; it's real." *Feel:* trust, settledness. *Do:* keep scrolling (no action asked — asking here would be premature). *Differs from hero:* full-bleed image → quiet paper and type; the register drops from cinematic to intimate, proving the site has more than one voice. Recognition folded in as one honest line because a fictional-awards wall would be both off-brand and a fabrication — the two facts we have (1968, five stars) are stronger stated plainly.

### 3.2 Rooms — *the private world*

- **P:** Convert general desire for the place into specific desire for *a room of one's own* — the emotional pivot from admiring to imagining.
- **UG:** "Which room is ours? What does it look and feel like? Roughly what does it cost?"
- **BG:** Drive the primary revenue decision; route depth-seekers to `/rooms`; feed the highest-intent moment on the page to Reserve.
- **CP:** ① Three featured rooms — **Ocean View Suite** (the icon: private balcony, the view), **Garden Room** (the accessible entry point, from $450), **Presidential Suite** (the aspiration: full-corner ocean) ② one feeling-line per room, one fact-line per room (view · sleeps · from-rate) ③ doorway to all five: *All rooms & rates →* `/rooms`.
- **L:** Editorial alternation — large image left/text right, then mirrored, then mirrored again. Not a card grid: a grid of equal cards says "inventory"; alternating spreads say "portraits." Rates present but set small in small caps — honest, unafraid, unshouted ("from $750").
- **VH:** Room photograph → room name (serif) → the feeling line → the fact line → quiet text link (*See this room*).
- **IO:** Hover: the image eases imperceptibly closer, a brass underline draws under the room name (the CD's premium-hover vocabulary). Each room links to its anchor on `/rooms`. A contextual, quiet *Reserve* text link may follow the third room — the page's **first contextual booking CTA**, placed exactly where first-peak intent occurs.
- **T:** From the room, outward to the day: a dusk-toned Dining image enters full-bleed — the light literally changes with the scroll.
- **UX:** *Think:* "The Ocean View Suite. That one." *Feel:* private longing — this is where the visitor mentally checks in. *Do:* open a room's detail, or begin drifting toward Reserve. *Differs from Introduction:* type-led paper gives way to image-led spreads; the rhythm becomes a slow left-right alternation. Featuring three (not all five) keeps curation credible — Family and Accessible rooms are one link deep with equal dignity on `/rooms`, not squeezed into the emotional spine where they'd dilute the icon/entry/aspiration triad.

### 3.3 Dining — *the table*

- **P:** Add the rhythm of the day to the imagined stay — the warmest emotional register on the page. A stay becomes vivid when it has evenings.
- **UG:** "Where do we eat? What's the evening like?"
- **BG:** Sell the on-property evening (rooftop reservations are recommended — a booking behavior worth planting now); differentiate the two venues cleanly so both audiences (couples / families) see their own evening.
- **CP:** ① **The Rooftop at Bellevue** — coastal Mediterranean, dinner 6–10 PM, dusk, the site's golden image ② **Palm Terrace** — all-day, breakfast in morning light, family-friendly ③ practical whisper-line each (hours · dress · *reservations recommended*) ④ doorway: *Dining at Bellevue →* `/dining`.
- **L:** Two movements, unequal on purpose. The Rooftop gets the full-bleed dusk spread — the darkest, warmest moment so far on the page. Palm Terrace follows smaller and brighter — morning after evening. The inequality is the information: one is the occasion, one is the rhythm.
- **VH:** Dusk photograph → venue name → cuisine/feeling line → whispered practicalities → link.
- **IO:** Hover states as §3.2. The Rooftop's *reservations recommended* line is a quiet planted seed the concierge widget can later harvest (dinner reservations are a lead-capture scenario in the product's playbook).
- **T:** From the warmest register to the palest: dusk gives way to the Spa's near-white spaciousness — the strongest single tonal cut on the page, and it's deliberate (ritual → surrender).
- **UX:** *Think:* "Dinner on that rooftop, that's the anniversary night." *Feel:* warmth, appetite, occasion. *Do:* note the rooftop; possibly open `/dining`. *Differs from Rooms:* the alternating spreads give way to one dominant full-bleed dusk moment — the page's tonal temperature visibly rises, so the scroll feels like time passing (afternoon → evening), which is the storytelling working.

### 3.4 Spa — *surrender*

- **P:** The deepest calm on the page — the section that *demonstrates* the brand's stillness rather than claiming it. Also the widest-margin section: whitespace as amenity, most literally applied here.
- **UG:** "Can I actually let go here?"
- **BG:** Sell high-margin treatments; plant the Couples Massage (anchor of the anniversary and honeymoon [bundles](16-demo-property-content.md)) for the widget demo to pay off.
- **CP:** ① One line of feeling (water, quiet, time) ② two named treatments only — **Couples Massage** ($420 / pair) and **Hot Stone Therapy** — as small-caps entries, not a menu table ③ doorway: *The full spa menu →* `/spa`.
- **L:** The sparsest section: one photograph (treatment room or water, pale register), a short serif line, two treatment entries set like a fine menu card, extravagant margins. If the build ever needs to cut scope, this section loses *elements* last and *density* first.
- **VH:** Pale photograph → feeling line → two menu entries → link.
- **IO:** Almost none, deliberately — stillness is the interaction. The two entries link into `/spa` anchors.
- **T:** Exhale complete, the page widens back outward — the Experiences row enters with slightly more structure and energy, like waking rested.
- **UX:** *Think:* "I'd finally slow down." *Feel:* surrender — the page's lowest heart rate. *Do:* nothing; that's the point (the doorway exists for the intent-driven). *Differs from Dining:* maximum tonal cut on the page — darkest/warmest to palest/emptiest. Featuring two treatments (not five) keeps the menu-card feel; the full table lives on `/spa` where task-mode visitors want it.

### 3.5 Experiences — *the days*

- **P:** Widen the stay from the room out into *days* — gentle possibility, the shape of a week. Also the section that makes the property feel alive for **both** audiences (couples *and* families) without splitting the page.
- **UG:** "What would we actually do?"
- **BG:** Sell bookable experiences (sailing $350, cabana $250, Kids' Club $85); signal family-readiness without diluting the romantic register; route to `/explore`.
- **CP:** ① **Sunset Sailing Charter** (the romance) ② **Private Beach Cabana** (the stillness) ③ **Kids' Club Adventure Day** (the family signal) ④ one whisper-line each (duration · price · lead time) ⑤ doorway: *Days at Bellevue →* `/explore`.
- **L:** A three-item editorial row — the page's most structured moment, and acceptable now precisely because five sections of looseness preceded it. Equal visual weight across the three: the triad *is* the message (romance · rest · family, one hotel).
- **VH:** Three photographs in a row → names → whisper-lines → single shared doorway link.
- **IO:** Hover per item; each links to its `/explore` anchor. Lead-time lines (*24 hrs notice*) quietly train visitors that these are *arranged* things — concierge territory, again seeding the widget's job.
- **T:** Words step aside entirely — the Gallery begins, full-bleed, unlabeled.
- **UX:** *Think:* "Sailing one evening; the kids are covered; I might not leave the cabana." *Feel:* easy anticipation — aspiration without adrenaline. *Do:* browse; possibly open `/explore`. *Differs from Spa:* emptiest to most structured — the rhythm consciously re-energizes before the immersive gallery. Kids' Club placed third, not hidden: family capability is a fact of this property (and a [demo scenario](13-sales-demo-script.md)); position it with dignity inside the triad rather than as a separate "family" section that would fracture the page's single calm voice.

### 3.6 Gallery — *remembrance*

- **P:** The wordless beat. After five sections of telling, a stretch of pure *showing* — the visitor drifts through images as if remembering a stay they haven't had yet.
- **UG:** None articulable — this section serves feeling, not tasks. (Task-mode visitors scroll through it in two seconds and lose nothing; that's by design.)
- **BG:** Deepen desire immediately before the trust-and-close sequence (testimonials → location → booking); give the property's photography one uninterrupted showcase.
- **CP:** ① 4–6 images, sequenced like a day: morning water → pool → a detail (linen, brass, stone) → dusk terrace ② at most one caption each, small caps, optional.
- **L:** Full-bleed images in sequence, generous vertical breathing space between them; sizes may vary (one monumental, one intimate pair) but no masonry grid, no lightbox chrome, no thumbnails. Scroll *is* the gallery mechanism — nothing to operate.
- **VH:** Image → (whispered caption). Nothing else exists here.
- **IO:** None beyond the scroll. Deliberately: an interactive gallery (arrows, lightboxes) turns remembrance back into interface.
- **T:** Out of the last dusk image, a single quoted line of type appears on paper — a human voice after the silence.
- **UX:** *Think:* nothing verbal — that's success. *Feel:* immersion; "I can see us there." *Do:* drift. *Differs from Experiences:* structure dissolves entirely — the page's only fully wordless passage, placed late so the images land on a visitor who already cares.

### 3.7 Testimonials — *the proof*

- **P:** Reassure, don't persuade. Quiet confirmation from human voices that the feeling the visitor has built is real — placed *after* desire, where social proof consoles rather than sells.
- **UG:** "Do people like us love it here? Is it what it looks like?"
- **BG:** De-risk the booking decision at the exact point the visitor starts rationalizing; reinforce the return/permanence positioning (guests who *come back* are the strongest possible proof of "the quiet constant").
- **CP:** ① Three short guest voices maximum, one visible at a time ② each attributed simply (*— R. & M., returning guests since 2009*) ③ nothing else — no logos, no scores, no five-star graphics.
- **L:** One quote at a time, set large in the display serif on paper — read as an inscription, matching the Introduction's register (the page's two "trust" sections rhyme visually; that's intentional). Quiet dot/indicator to move between the three, or simply stack them with generous space — *no autoplaying carousel* (CD forbids it).
- **VH:** The quote → attribution → (navigation whisper).
- **IO:** Manual, optional advancing only. No motion unless invited.
- **T:** From the human voice to the ground truth — the coastline map/photograph of Location enters, and the register turns factual.
- **UX:** *Think:* "They keep coming back." *Feel:* reassurance, quiet confidence. *Do:* none required. *Differs from Gallery:* image-immersion snaps to near-pure typography — the strongest content-type cut on the page. **Content gap, flagged:** [docs/16](16-demo-property-content.md) contains no testimonial copy. Three short quotes must be authored into docs/16 (fictional guests for a fictional property — but written to the brand voice, emphasizing *return*, e.g. honeymoon-then-family arcs that echo the bundles). The build should not invent them ad hoc.

### 3.8 Location — *the map*

- **P:** Ground the dream in geography — the moment desire becomes *plan*. Every prior section said "imagine"; this one says "it's real, and it's reachable."
- **UG:** "Where exactly is it? How do we get there? What's nearby?"
- **BG:** Remove the practical unknowns that stall bookings; surface the local-recommendation content that makes the property feel embedded in a real place (and that the concierge answers questions about).
- **CP:** ① Oceanfront, Bellevue Cove ② *25 minutes from Bellevue Regional Airport* ③ two or three local notes from [docs/16 §8](16-demo-property-content.md) — the Cliffside Coastal Trail (*5 min walk, the best sunrise in the cove*), Harbor Row Sushi, the Saturday Marina Farmers Market ④ doorway: *Exploring the cove →* `/explore`.
- **L:** A split register: one side the coast (a stylized map or an aerial coastline photograph — whichever the photography sourcing supports; a generic embedded map widget is off-brand and should be avoided on the homepage), the other side the facts set in the small-caps informational voice. First section where *information* leads.
- **VH:** Coast image/map → the airport line (the #1 practical question) → local notes → link.
- **IO:** Local notes may link to `/explore` anchors. If a live map is offered at all, it's behind a quiet *Open map* action — never auto-loaded chrome.
- **T:** The facts settle the mind; the page then opens its final full-bleed image — the horizon again, later in the day — and the invitation is made.
- **UX:** *Think:* "Twenty-five minutes from the airport — easy." *Feel:* grounded; the fantasy now has coordinates. *Do:* maybe check `/explore`; mentally book flights. *Differs from Testimonials:* voice → fact; serif inscription → informational small caps. Placing Location *after* proof and *before* the close follows the natural decision sequence: want it → believe it → confirm it's feasible → act.

### 3.9 Practical notes — *the desk* (micro-section)

- **P:** Answer the transactional questions (check-in, pets, parking, cancellation) with the composure of a good front desk — and hand everything else to the concierge. This replaces the conventional FAQ accordion.
- **UG:** "Check-in time? Can we bring the dog? What if plans change?"
- **BG:** Kill booking-blocking doubts at near-zero visual cost; **create the page's one explicit invitation to use the AI concierge** — the product demo's purpose, built into the site's own logic.
- **CP:** ① Four facts only, one line each, from [docs/16 §9](16-demo-property-content.md): check-in 3 PM / check-out 11 AM · pets welcome in select rooms · free cancellation to 48 hours · valet & self-parking ② one closing line: *Anything else — our concierge is here at any hour* → opens the widget.
- **L:** The smallest section on the page: a single elegant row/box of fine-print-styled small caps, the typographic register of a printed hotel card. No accordion, no icons, no expandable anything.
- **VH:** The four facts (equal weight) → the concierge line.
- **IO:** The concierge line is the section's only action and programmatically opens the widget — the *single* place on the page that explicitly points at it. (One invitation, well-placed, beats persistent nagging — and in the sales demo, this is a scripted beat: the site itself hands questions to the AI.)
- **T:** Practicalities settled, the final image opens — nothing left between the visitor and the decision.
- **UX:** *Think:* "48-hour cancellation — no risk." *Feel:* confidence; the last frictions dissolve. *Do:* possibly open the concierge. *Differs from Location:* even smaller and quieter — the page is deliberately decrescendoing so the Booking Invitation lands as the finale. The cancellation policy is placed *here*, immediately before the close, because generous cancellation is the strongest friction-killer the property has.

### 3.10 Booking invitation — *the return*

- **P:** The close. The hero's horizon reprised at dusk, the invitation made once, plainly — booking as the natural conclusion of a calm decision, not a converted funnel.
- **UG:** "Alright — let's do it."
- **BG:** The page's primary conversion moment; every earlier section exists to make this one quiet ask sufficient.
- **CP:** ① The reprised horizon photograph (same view as the hero, later hour — the bookend) ② one serif line in the brand's closing voice (*Come. It's still here.* — or a variant per CD §8) ③ the **Reserve** action, at last given full visual weight (the page's largest and only prominent CTA) ④ one whisper-line beneath it: *Free cancellation until 48 hours before arrival* — the single trust fact worth repeating at the point of action.
- **L:** Full-bleed dusk horizon; line and action centered in the sky's quiet zone, mirroring the hero's composition exactly — arrival and invitation as a matched pair.
- **VH:** Photograph → the line → Reserve → the cancellation whisper.
- **IO:** Reserve opens the booking flow (§6). Nothing else is interactive.
- **T:** Into the footer's composed ink — the farewell.
- **UX:** *Think:* "This is the one." *Feel:* calm resolve — readiness without pressure. *Do:* Reserve. *Differs from Practical Notes:* the page's quietest micro-section explodes into its final full-bleed moment — the largest single rhythm change on the page, held for the ending. The hero/close mirroring is the architecture's signature move: the page opens on the view and closes on the same view at dusk, so the visit itself has enacted "the unchanging horizon."

### 3.11 Footer — *the farewell*

- **P:** A gracious, ordered close — the hotel's card left on the pillow. Also the honest home of everything that never belonged in the story: full nav, weddings, policies, contact.
- **UG:** Reach anything not surfaced above (weddings, full policies, contact details).
- **BG:** Catch secondary audiences (event planners → `/weddings`) and unresolved visitors (one last quiet Reserve link) without ever having burdened the narrative.
- **CP:** ① Wordmark + one-line address (*Oceanfront, Bellevue Cove*) ② nav columns: Stay (rooms/dining/spa/explore) · Occasions (weddings & events) · The Desk (policies · contact · reserve) ③ the standing line (est. 1968) ④ legal whisper.
- **L:** Ink background (the page's darkest paper), ordered small-caps columns, generous padding — composed, not crammed.
- **VH:** Wordmark → columns → standing line → legal.
- **IO:** Standard link behavior; nothing animated beyond the site's quiet hover vocabulary.
- **UX:** *Think:* "Everything's findable." *Feel:* hosted to the last pixel. *Do:* navigate or leave — either way, the closing impression is order and warmth. Weddings surfaces here (and only here on the homepage) because its audience arrives *searching* for it — burying it costs nothing; featuring it mid-page would cost the narrative its single voice.

---

## 4. Storytelling — the emotional journey, end to end

The page is an *arrival enacted in scroll*. Its emotional curve, with the rhythm moments named:

1. **Calm** (Hero → Introduction): pulse drops, trust forms. Two sections with no ask at all — the confidence play that separates this site from every urgency-driven competitor.
2. **Intimacy** (Rooms): the first want — private, specific. First contextual CTA appears exactly here, at first-peak intent.
3. **Excitement, warm register** (Dining): the page's temperature rises — dusk, gold, appetite. "Excitement" at Bellevue is a candlelit rooftop, not a jet ski; the CD's calm is never broken, only warmed.
4. **Deepest calm** (Spa): the counter-beat — near-white emptiness right after the warmest moment. The page breathes in extremes here, and the contrast makes both sections land.
5. **Aspiration** (Experiences → Gallery): possibility, then wordless immersion. Desire completes itself in the visitor's own imagination — the gallery hands them the pen.
6. **Reassurance** (Testimonials → Location → Practical notes): three trust beats in descending size — human proof, geographic grounding, transactional confidence. The page gets *quieter* as it approaches the ask, the opposite of conventional landing pages that crescendo into the CTA.
7. **Resolve** (Booking invitation): one full-bleed moment, one line, one action. The horizon returns; the circle closes.

No two consecutive sections repeat a register (§1.4 table is the enforcement checklist), and the three big contrast cuts — dusk→pale (Dining→Spa), image→word (Gallery→Testimonials), whisper→full-bleed (Practical→Invitation) — are the page's memorable "moments."

---

## 5. Mobile experience

**Philosophy** ([CD principle 18](18-demo-bellevue-creative-direction.md)): mobile is likely the *first* impression and carries the full weight of the stillness — a reframing, never a compression. Portrait art-direction for all full-bleed photography (horizon kept low), the same generous vertical spacing (mobile luxury dies by tightened margins), type staying large and confident.

Per-section adaptation:

| Section | Mobile adaptation |
|---|---|
| Header | Wordmark + Reserve always visible; remaining nav behind a quiet menu control (full-screen, calm, generously spaced when open — a page of its own, not a hamburger drawer) |
| Hero | Portrait crop, name may break to two lines, first-scroll moment preserved |
| Introduction | Passage first, photograph after; reading measure stays comfortable |
| Rooms | Alternating spreads become full-width image-over-text stacks; the alternation reads as sequence instead of mirroring — same portraits, vertical hanging |
| Dining | Rooftop keeps the full-bleed dusk moment; Palm Terrace stacks after |
| Spa | Whitespace preserved — this section is *not* shortened on mobile; its emptiness is its content |
| Experiences | The triad stacks vertically in the same order (romance · rest · family); no horizontal swiping — the page has one scroll axis, everywhere |
| Gallery | Full-width images in sequence — native vertical scroll is the gallery's ideal form; mobile is this section's best self |
| Testimonials | One quote per viewport, stacked |
| Location | Coast image above, facts below; airport line stays first |
| Practical notes | Four facts stack; concierge line stays last and prominent — on mobile the widget opens as a full-screen takeover (per the product's widget spec), so this handoff must feel deliberate |
| Booking invitation | Full-viewport dusk portrait; Reserve at comfortable thumb height, ample touch target |
| Footer | Columns stack in the same order; nothing dropped |

**Widget on mobile:** the launcher must never overlap the Reserve action in the Booking Invitation — the two conversion paths (human-form and concierge) coexist; colliding them is the one unforgivable mobile layout bug. Reserve occupies the section's center; the launcher holds the corner.

---

## 6. Conversion strategy

**Where booking CTAs appear — exactly four, in escalating weight:**
1. **Header Reserve** — persistent, silent, every page, every scroll position. The safety net that lets everything else stay quiet.
2. **Post-Rooms contextual link** (§3.2) — quiet text link at first-peak intent.
3. **Booking Invitation** (§3.10) — the one full-weight CTA on the site.
4. **Footer** — a last quiet Reserve link for visitors who scrolled past the invitation unresolved.

Nothing floats over content, nothing is sticky except the header, nothing pulses. Four is the count because each maps to a distinct visitor state: always-ready / first desire / decided / almost-left.

**How trust is established — in sequence, by design:** standing (est. 1968 · five stars, §3.1) → honest rates shown early, unhidden (§3.2) → human proof from *returning* guests (§3.7) → geographic grounding (§3.8) → the 48-hour cancellation policy delivered twice: once at Practical Notes and once as the whisper under the final Reserve. Trust on this page is *sequenced* — earned progressively rather than badge-dumped.

**Where urgency is introduced: nowhere.** No countdowns, no "only 2 rooms left," no recently-booked toasts — [CD principle 13](18-demo-bellevue-creative-direction.md) makes this non-negotiable, and it is the *strategy*, not the absence of one: for this audience, pressure signals desperation and desperation reads as mid-market. The urgency-shaped work is done instead by **generous reversibility** (free 48-hour cancellation, stated at the point of action) — "book now, decide later" achieves what countdown timers attempt, without costing the brand its composure.

**How friction is minimized:**
- Reserve reachable in one interaction from any scroll position on any page.
- Rates published plainly on the homepage — no "contact for pricing" games.
- The booking flow itself (the *concierge, not the checkout* — CD §5): dates · room · guests · name & contact, nothing more. No account creation, no upsell interstitials, no urgency banners inside the flow. Calm confirmation with a human tone. *(For the demo build, the flow terminates in a gracious confirmation rather than a live payment — a demo property takes no cards; the flow's UX is still specified because it's part of what's being shown.)*
- The concierge widget as the friction *interceptor*: every "one unanswered question away from booking" visitor (pet fees, connecting rooms, dietary options) has a 24-hour answer path that never leaves the page — and lead capture inside the widget (a core product behavior) means even a visitor who doesn't book leaves a thread the hotel can pull.

**How the page encourages reservations, structurally:** the whole architecture is the answer — desire built in acts (room → evening → rest → days), proof placed where doubt forms, practicalities settled immediately before the ask, and a single confident invitation at the end mirrored on the view the visitor arrived to. The page never chases; it composes the conditions under which booking is the visitor's own idea.

---

## 7. The AI Concierge widget — architectural placement

The reason this site exists ([Sales Demo Script](13-sales-demo-script.md)). Blueprint-level requirements:

- **Presence:** embedded via the real `<script>` tag on every page ([docs/16 §1](16-demo-property-content.md)) — the honest production integration path, not a fake inline component.
- **Entrance:** labeled launcher (text, not a bare icon bubble), appearing after the product-specified 5–8 s delay, bottom-right. It must feel like part of the hotel — Classic Luxury preset, the site's own warmth — not a third-party chip pinned on top.
- **The one explicit invitation:** Practical Notes' closing line (§3.9) is the single place the page itself points to the widget. Everywhere else it waits, like good staff.
- **Layout law:** the launcher never overlaps a Reserve action at any breakpoint (§5).
- **Demo choreography note:** the homepage deliberately plants the seeds the [demo scenarios](13-sales-demo-script.md) harvest — the Rooftop's *reservations recommended*, the spa's Couples Massage, the experiences' lead times, the pets line in Practical Notes. When the demo audience asks the widget about an anniversary, the site has already shown the ingredients the AI composes into the [anniversary bundle](16-demo-property-content.md). Site and widget must read as *one host*.

---

## 8. Content gaps this blueprint surfaces (for docs/16)

1. **Testimonials** — three short returning-guest quotes, written to brand voice (§3.7). Not to be improvised at build time.
2. **Hero + closing horizon photographs** — the same view at two times of day (§2, §3.10); add to the [photography sourcing plan](16-demo-property-content.md) explicitly, since the bookend depends on the pairing.
3. **One-line feeling copy** per featured room / venue / treatment / experience (the homepage's "one line of feeling" layer is thinner than full descriptions and isn't in docs/16 yet).
4. **Gallery captions** (optional, small caps) — 4–6, if used.

---

**Next:** visual design (moodboard → art-directed comps) against the [Creative Direction](18-demo-bellevue-creative-direction.md), then the Sprint 5 build of `apps/demo-bellevue` per the [Sprint Backlog](14-sprint-backlog.md). This blueprint is the structural contract for both.
