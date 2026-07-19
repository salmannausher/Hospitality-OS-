# Sales Demo Script — Pitching Adam

**Product (in this room, out loud):** Spherical AI Concierge
**Product (internally, never said in this meeting):** Hospitality AI OS
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [Conversation Playbook](04-conversation-playbook.md) · [UX Flows](05-user-experience-flows.md) · [UI Design System](08-ui-design-system.md)

Everything else in this project is a spec for engineers. This one is for a 30-minute meeting. Different job, different rules: shorter sentences, a script you can actually say out loud, and one goal — leave with a yes to a single pilot hotel, not a yes to a platform.

---

## 1. The One Ask, Stated Up Front So Nothing Else Drifts

**Do not pitch "Hospitality AI OS," a platform, or a company-wide rollout.** Pitch: *"Let's put this on one hotel's website for 60 days and see what happens."* Everything in this script — the demo, the numbers, the objection answers — exists to make that one ask easy to say yes to. A bigger ask is a harder no waiting to happen; a pilot is a decision Adam can make in the room.

**Never say "Hospitality AI OS," "platform," or "Devsphinx builds this for other agencies too" in this meeting.** In the room, this is Spherical's product — "Spherical AI Concierge," or no name at all, just "the concierge." The platform framing is true and it's in [PRD §1](01-PRD-ai-concierge.md), but it's a conversation for after the pilot works, not before it exists.

## 2. Meeting Structure (30 Minutes)

| Time | Section | Goal |
|---|---|---|
| 0–5 min | The opportunity | Reframe from "AI chatbot" to "recurring revenue on every website you already build" |
| 5–15 min | Live demo | No slides. Adam should be looking at the actual product, not a deck. |
| 15–25 min | The business case | Setup fee, monthly split, what it costs Spherical, what it costs Devsphinx |
| 25–30 min | The ask | One hotel, 60 days, defined success criteria |

## 3. Opening — Say This, Not That

**Say:**

> "I've been thinking about how Spherical could add a recurring AI service to every hotel website you build, instead of the relationship ending at launch. I put together a working prototype using one of your hotels as the example — want to see it?"

**Don't say:** "I built an AI chatbot." "I have an idea for an AI product." Anything with the words "platform," "SaaS," or "Hospitality AI OS." The opening framing is business opportunity first, product second — Adam runs an agency; he's pitched ideas constantly, and "I have an AI idea" is background noise. "Recurring revenue on work you've already sold" is not.

## 4. The Live Demo — Exact Script

Ten minutes, using **Bellevue Hotel** as the example (the same example threaded through every doc — the Playbook scenarios below are pre-validated, not improvised). Visual base: **[Option A — Heritage](08-ui-design-system.md)**, the closest match to the original "Apple designed for Aman Resorts" brief — see §7 for why, and what to do if there's time to show more.

**What "Bellevue Hotel" actually is, operationally:** a real, running, single-page site Devsphinx builds and hosts — not a real hotel's live production website, and not a screenshot or mockup. This matters for Beat 1 below, which depends on the launcher genuinely appearing after its delay ([UX §2](05-user-experience-flows.md)) — that only works on a page that's actually running the widget. Content (room descriptions, dining, spa, policies) is authored by Devsphinx to match the IA entity types, and photography is licensed stock or generated — not pulled from a real hotel's site. **Bellevue is a fictional/composite property for this demo**, deliberately not presented as one of Spherical's real named clients without their sign-off; if Adam wants the demo re-skinned to resemble an actual portfolio hotel after this meeting, that's a fast follow-up done with their explicit permission, not something to do beforehand. Building this page is an explicit task in the [Development Plan](11-development-plan.md), not an assumption.

**Beat 1 — First impression (30 seconds).** Load the hotel homepage. Don't touch anything. Let the launcher appear on its own after the delay ([UX §2](05-user-experience-flows.md)). Say nothing until it appears — the pause is the point.

> "Notice it didn't pop up immediately demanding attention. It waits, the way a concierge would."

**Beat 2 — The quick-start moment (1 minute).** Open the widget. Tap **"Romantic Escape."** This is [Playbook G-05](04-conversation-playbook.md) — the anniversary relationship bundle. Watch it return one coherent recommendation (Ocean View Suite + rooftop dinner + couples massage), not three separate answers.

> "It didn't just search documents and return a list. It knows an anniversary, an ocean-view suite, and a couples massage are the same recommendation — because someone on the hotel's team curated that pairing once, and every guest with that occasion gets it."

**Beat 3 — Lead capture, live (1 minute).** Let the flow continue to the Yes/No email offer ([UX §4](05-user-experience-flows.md)). Say yes on camera.

> "It only asked once it had already been useful, and it asked for one thing at a time — this is what shows up as a qualified lead in the dashboard in about ten seconds."

**Beat 4 — Switch to the dashboard, the actual revenue argument (2 minutes).** Show the lead just captured in the **Leads inbox**, then the **Missing Information** panel ([UX §12](05-user-experience-flows.md)).

> "This is the part that matters more than the chat widget. Every time a guest asks something the concierge doesn't have a confident answer for, it tells the hotel exactly what to upload next — instead of just failing quietly. This is also why the relationship doesn't end at launch: there's always a next thing to improve, which is the recurring part of recurring revenue."

**Beat 5 — Prove it's every hotel, not just Bellevue (1–2 minutes).** Open **Brand Settings**, switch the tone preset and accent color live, show the widget preview update instantly.

> "This is the same product for Rosewood, for EDITION, for Waldorf — the concierge's voice and look change, the underlying intelligence doesn't. You don't rebuild this per client; you configure it."

**Do not show:** a live booking-engine transaction (doesn't exist — [PRD §19](01-PRD-ai-concierge.md)), a second hotel mid-meeting (one hotel, fully polished, beats two half-shown), or all four design-system options ([08a–d](08-ui-design-system.md)) — that's an internal decision, not something to make Adam choose in the room.

## 5. The Business Case — Say the Real Numbers

> "The setup is $3,000 to $5,000 per hotel, plus a monthly fee between $300 and $800 depending on tier. On a $500/month hotel, Spherical keeps $300, we keep $200 — you're not paying us out of pocket, the hotel is, and it's revenue that didn't exist on this account before."

> "At 100 hotels, that's roughly $30,000 a month for Spherical, on top of what you already bill for the website itself. This isn't instead of your existing business — it's a line item added to every project you already do."

**If asked what it costs to build/run:** near-zero infrastructure cost at pilot scale ([Architecture §8](06-system-architecture.md)) — this isn't Adam's problem to solve, but "we've engineered this to be cheap to run" is a fair, honest answer if he asks.

## 6. Objections — Prepared, Not Improvised

| Adam asks | Answer |
|---|---|
| "What if it says something wrong to a guest?" | It's built to say "I don't have confirmed information" and offer a human instead of guessing — [ABS §4–6](02-ai-behavior-specification.md). That's the Missing Information panel from Beat 4: wrong answers become a to-do list, not a silent liability. |
| "How is this different from [Asksuite/HiJiffy/a generic chatbot vendor]?" | Those answer questions. This one knows the difference between a routine question and a complaint — the whole interface changes tone and stops recommending the instant a guest is unhappy ([ABS §16](02-ai-behavior-specification.md)) — and it curates recommendations by occasion rather than just retrieving documents (Beat 2). |
| "Will this distract my team?" | The setup is designed to take one hotel under 30 minutes to load with content ([PRD §20](01-PRD-ai-concierge.md)) — it's closer to filling out a form than running a project. |
| "Can we white-label this / is it locked to your company?" | Multi-tenant from the ground up ([DB Design](07-database-design.md)) — every hotel is isolated, every hotel can look different, and yes, it can carry Spherical's name. |
| "How fast can we pilot?" | One hotel, 60 days, starting as soon as you pick the property. |
| "What do you need from me right now?" | One hotel from your portfolio and an introduction to whoever manages that property's content. That's the entire ask. |

## 7. Which Design Direction to Show — and Why

Four visual directions exist ([08a–d](08-ui-design-system.md)) — this is a Devsphinx decision, not something to present as a menu to Adam. **Recommendation for this specific meeting: Option A (Heritage)** as the base — it's the most complete, the most directly aligned with the original brief ("Apple designed for Aman Resorts"), and the safest bet for a first impression that has to land in ten minutes with no room for a rough edge.

**If there's appetite to make it more memorable and there's time to build it in:** layer **Option D's** behavioral choreography on top — specifically, the Breath before the concierge answers, and the room visibly quieting during a complaint. That's the single moment most likely to make Adam say "this isn't just a chatbot" out loud, because it's not something a screenshot or a competitor's demo video can show. It's a Phase 5 build decision ([Development Plan](11-development-plan.md)), not something to promise before it exists.

## 8. After the Yes

Don't leave this open-ended in the room — state the next steps out loud:

1. Adam names the pilot hotel this week.
2. Devsphinx gets access to that hotel's content (menus, room descriptions, policies) — the same 30-minute load process just demonstrated.
3. Pilot runs 60 days against the criteria already defined in [PRD §20](01-PRD-ai-concierge.md): sub-30-minute setup, accurate answers, real leads captured, staff actually checking the dashboard.
4. Check-in at 30 days, not just at the end — catch problems while there's still time to fix them before the pilot's verdict is decided.

## 9. After a No, or a Maybe

Don't push for the platform conversation as a fallback. A "let me think about it" is answered with: "Totally fair — what would you need to see to feel good about one hotel trying it?" That question does more work than a follow-up deck.

---

**This is the last document.** Everything from here is building the thing this script describes, then giving this meeting.
