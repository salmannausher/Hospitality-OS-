# Devsphinx Product Landing Page — Plan

**Product:** Hospitality AI OS
**Depends on:** [PRD](01-PRD-ai-concierge.md) · [UI Design System](08-ui-design-system.md) · [Sales Demo Script](13-sales-demo-script.md)

Separate from [the Bellevue demo](16-demo-property-content.md) in every way that matters: different audience, different job, different urgency.

---

## 1. Audience & Job

**Not Adam, not Spherical** — the [Sales Demo Script](13-sales-demo-script.md) is explicit that platform framing stays out of that room entirely. This page is for:

- Other hospitality marketing/digital agencies who could become the same kind of partner Spherical might be
- Hotel groups evaluating a direct relationship, if that path opens up later
- A credibility/portfolio artifact for Devsphinx generally

**One job:** get a reply, not a sale. The CTA is "see it live" / "get in touch" — a single-page site whose entire purpose is starting a conversation, per the original strategic framing that runs through this whole project ("preserve optionality" — [PRD §1](01-PRD-ai-concierge.md)).

## 2. Positioning — What NOT to Say

Skip every generic AI-startup landing page move: no "revolutionize hospitality with AI," no chatbot-icon hero, no feature-grid of things that don't exist yet. The actual differentiators are already built and documented — say those, specifically:

- **Not a chatbot — staff.** The one thing every prior document has protected relentlessly (no bubble for the concierge, never says "as an AI," escalates the instant a guest is unhappy).
- **Never invents information.** Confidence-gated grounding, and the failure mode most competitors hide (a wrong answer) becomes an admin's actionable "upload this next" report instead.
- **Understands relationships, not just documents.** The IA §12 relationship layer — an anniversary, an ocean-view suite, and a couples massage are the same recommendation, not three separate lookups.
- **White-label, multi-tenant from day one.** One hotel or a thousand without a rebuild — the actual point of this page existing at all.

## 3. Sitemap

Single page, one scroll — this isn't a product with enough surface area yet to justify multiple pages, and a long, unfocused site reads as less confident than a tight one:

```
Hero
The problem (what every hotel chatbot gets wrong)
What makes this different (4 differentiators, above)
For agencies (the partner/white-label pitch)
See it live (demo preview / link)
Contact
```

## 4. Copy Draft

**Hero**
> Software that behaves like staff.
>
> Hospitality AI OS is the AI concierge platform built specifically for luxury hotels — grounded in what your property actually offers, never guessing, and white-label ready for the agencies who build their websites.
>
> [See it live] [Get in touch]

**The problem**
> Every hotel chatbot on the market answers questions. Almost none of them know the difference between a routine question and a guest who's genuinely unhappy — and the ones that don't invent an answer when they're unsure just guess anyway.

**What makes it different**
1. *Never invents information.* When it isn't confident, it says so — and tells the hotel exactly what to upload next, instead of failing silently.
2. *Understands relationships, not just documents.* An anniversary, an ocean-view suite, and a couples massage are the same recommendation — curated once, not searched for three times.
3. *Knows a complaint when it hears one.* The moment a guest is unhappy, the entire interface changes — no recommendations, no upsells, straight to a human.
4. *White-label, multi-tenant from day one.* One hotel or a thousand, each with its own voice and branding, without touching the underlying platform.

**For agencies**
> If you already build websites for hotels, this is a recurring line item on every project you already sell — not a new business to run. White-labeled under your name, configured per client, supported by us.

**See it live**
> [Embedded preview or link to the Bellevue demo once Sprint 5 ships]

**Contact**
> A short form or direct email — this page's only real job.

## 5. How This Gets Built

**Built — it's the `/` route of `apps/web`** (`src/app/page.tsx` + `src/components/landing/`), implemented July 2026 after the first visual pass (an artifact skinned in Option A's product tokens) was rejected as not premium. The build deliberately does **not** reuse the product design system: it has its own editorial language — Fraunces (display serif) + Instrument Sans, warm ivory/ink paper palette with brass/champagne accents, and two espresso-dark "evening" sections (the staged Bellevue conversation demo, and the closing CTA). Copy follows §4's draft; the sitemap follows §3, with one addition (a "How it begins" 3-step section) and the demo section realized as an animated conversation rather than an embed (the Bellevue demo doesn't exist yet — swap in a real link/embed once Sprint 5 ships). Motion via the `motion` package (Framer Motion's successor), restrained scroll reveals only, `prefers-reduced-motion` respected. The contact email in `src/components/landing/constants.ts` is a placeholder — replace before deploying.

---

**See also:** [Demo Property: Bellevue Hotel](16-demo-property-content.md) · [UI Design System](08-ui-design-system.md)
