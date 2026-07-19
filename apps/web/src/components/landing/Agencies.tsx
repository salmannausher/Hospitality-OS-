import { TextLink } from "./CtaLink";
import { Kicker } from "./Kicker";
import { Reveal } from "./Reveal";
import { CONTACT_EMAIL } from "./constants";

export function Agencies() {
  return (
    <section id="agencies" className="px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Reveal>
              <Kicker index="05">For agencies</Kicker>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-8 font-display text-4xl font-light leading-[1.12] md:text-5xl">
                Your name on the door.
              </h2>
            </Reveal>
          </div>
          <div className="space-y-6 leading-relaxed text-ink-soft lg:col-span-6 lg:col-start-7">
            <Reveal delay={0.2}>
              <p>
                If you already build websites for hotels, this is a recurring
                line on every project you already sell — not a new business to
                run. White-labeled under your name, configured per client,
                supported by us.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p>
                One platform underneath. A portfolio of very different hotels
                on the surface — each with its own voice, its own brand, its
                own concierge.
              </p>
            </Reveal>
            <Reveal delay={0.4} className="pt-4">
              <TextLink href={`mailto:${CONTACT_EMAIL}`}>
                Start a conversation
              </TextLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
