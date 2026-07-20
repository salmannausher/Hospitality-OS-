import { Kicker } from "./Kicker";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Share",
    body: "Your website, menus, policies, PDFs — everything a new hire would be given to study on their first day.",
  },
  {
    n: "02",
    title: "Review",
    body: "It shows your team what it learned — and asks for exactly what's missing, before a guest ever has to.",
  },
  {
    n: "03",
    title: "Welcome",
    body: "It joins your website in your brand and your voice, greeting guests before, during, and after every stay.",
  },
];

export function HowItBegins() {
  return (
    <section className="bg-parchment px-6 py-28 md:py-36">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Kicker index="04">How it begins</Kicker>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-8 max-w-2xl font-display text-4xl font-light leading-[1.12] md:text-5xl">
            Give it your property. That&rsquo;s the setup.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={0.15 + i * 0.1}>
              <div className="border-t border-ink/15 pt-6">
                <span className="font-display text-4xl font-light italic text-brass">
                  {step.n}
                </span>
                <h3 className="mt-4 text-[0.75rem] font-semibold uppercase tracking-[0.22em]">
                  {step.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
