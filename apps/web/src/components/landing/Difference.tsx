import { Kicker } from "./Kicker";
import { Reveal } from "./Reveal";

const ITEMS = [
  {
    numeral: "I",
    title: "It knows when not to answer.",
    body: "When confidence is low, it offers a human handoff instead. The missing topic appears in the admin portal with a specific source for your team to add.",
  },
  {
    numeral: "II",
    title: "It connects occasions to recommendations.",
    body: "An anniversary, an ocean-view suite, and a couples massage are one recommendation — curated once by your team, not searched for three times.",
  },
  {
    numeral: "III",
    title: "It knows a complaint when it hears one.",
    body: "The moment a guest is unhappy, everything changes. No recommendations, no upsells — a graceful handoff to your staff, immediately.",
  },
  {
    numeral: "IV",
    title: "It carries each hotel's brand.",
    body: "White-label and multi-tenant from day one. One property or a portfolio — each with its own greeting, tone, logo, colors, typography, and booking link.",
  },
];

export function Difference() {
  return (
    <section id="difference" className="px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Kicker index="02">The difference</Kicker>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-8 max-w-2xl font-display text-4xl font-light leading-[1.12] md:text-5xl">
            Four differences built into the product.
          </h2>
        </Reveal>

        <div className="mt-20 grid gap-x-16 gap-y-16 md:grid-cols-2">
          {ITEMS.map((it, i) => (
            <Reveal key={it.numeral} delay={0.1 + i * 0.08}>
              <div className="group h-full border-t border-line pt-8 transition-colors duration-500 hover:border-brass/60">
                <span className="font-display text-2xl font-light italic text-brass">
                  {it.numeral}.
                </span>
                <h3 className="mt-5 font-display text-2xl font-light leading-snug md:text-[1.75rem]">
                  {it.title}
                </h3>
                <p className="mt-4 leading-relaxed text-ink-soft">{it.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
