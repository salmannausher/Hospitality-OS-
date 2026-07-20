import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { TESTIMONIALS } from "@/lib/content";

export function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="px-6 py-28 md:px-10 md:py-40"
    >
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Eyebrow tone="light">Returning guests</Eyebrow>
        </Reveal>
        <h2 id="testimonials-heading" className="sr-only">
          What returning guests say
        </h2>

        <div className="mt-16 space-y-20 md:space-y-24">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.attribution} delay={0.1 + i * 0.05}>
              <blockquote>
                <p className="font-display text-2xl font-light italic leading-snug text-ink md:text-3xl">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="mt-6 text-[0.72rem] uppercase tracking-[0.18em] text-ink-soft">
                  {t.attribution}
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
