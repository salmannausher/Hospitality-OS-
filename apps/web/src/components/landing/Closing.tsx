import { CtaLink } from "./CtaLink";
import { Kicker } from "./Kicker";
import { Reveal } from "./Reveal";
import { CONTACT_EMAIL, DEMO_MAILTO } from "./constants";

export function Closing() {
  return (
    <section
      id="book"
      className="grain relative bg-night px-6 pt-32 pb-28 text-ivory md:pt-44 md:pb-36"
    >
      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal>
          <Kicker index="06" tone="dark" centered>
            Begin
          </Kicker>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-10 font-display text-[clamp(2.5rem,6vw,5rem)] font-light leading-[1.05]">
            See it answer for{" "}
            <em className="italic text-champagne">your</em> property.
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-mist">
            A twenty-minute walkthrough with a live property — not a slide
            deck. We&rsquo;ll show you how it thinks, where it refuses to
            guess, and what it does when a guest is unhappy.
          </p>
        </Reveal>
        <Reveal delay={0.3} className="mt-12">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <CtaLink href={DEMO_MAILTO} variant="solid-dark">
              Book a demo
            </CtaLink>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-mist underline underline-offset-4 transition-colors duration-300 hover:text-champagne"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
