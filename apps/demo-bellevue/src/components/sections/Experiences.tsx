import Link from "next/link";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { EXPERIENCES } from "@/lib/content";
import { IMG } from "@/lib/images";

export function Experiences() {
  return (
    <section
      aria-labelledby="experiences-heading"
      className="bg-stone px-6 py-28 md:px-10 md:py-40"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <Eyebrow>Experiences</Eyebrow>
        </Reveal>
        <Reveal delay={0.1}>
          <h2
            id="experiences-heading"
            className="mt-6 max-w-lg font-display text-4xl font-light leading-[1.15] text-ink md:text-5xl"
          >
            The shape of your days.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {EXPERIENCES.map((exp, i) => (
            <Reveal key={exp.name} delay={0.1 + i * 0.08}>
              <article>
                <div className="aspect-[4/5] w-full overflow-hidden">
                  <TreatedImage
                    id={IMG[exp.image]}
                    alt={`${exp.name} at Bellevue Hotel`}
                    width={800}
                    className="h-full w-full transition-transform duration-[1200ms] ease-out hover:scale-[1.03]"
                  />
                </div>
                <h3 className="mt-6 font-display text-xl font-light italic text-ink">
                  {exp.name}
                </h3>
                <p className="mt-2 text-[0.72rem] uppercase tracking-[0.16em] text-ink-soft">
                  {exp.duration} · {exp.price} · {exp.leadTime}
                </p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mt-16">
          <Link
            href="/explore"
            className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors duration-300 hover:text-brass"
          >
            Days at Bellevue →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
