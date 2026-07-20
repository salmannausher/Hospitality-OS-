import Link from "next/link";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { SPA_TREATMENTS } from "@/lib/content";
import { IMG } from "@/lib/images";

const FEATURED = ["Couples Massage", "Hot Stone Therapy"] as const;

export function Spa() {
  const featured = FEATURED.map((name) =>
    SPA_TREATMENTS.find((t) => t.name === name)!,
  );

  return (
    <section
      aria-labelledby="spa-heading"
      className="px-6 py-32 md:px-10 md:py-48"
    >
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:items-center lg:gap-24">
        <Reveal>
          <div className="aspect-[3/4] w-full max-w-md overflow-hidden">
            <TreatedImage
              id={IMG.spaTreatment}
              alt="A quiet treatment at Bellevue Spa & Wellness Center"
              width={900}
              className="h-full w-full"
            />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <Eyebrow>Spa &amp; Wellness</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              id="spa-heading"
              className="mt-6 max-w-sm font-display text-4xl font-light italic leading-tight text-ink md:text-5xl"
            >
              Let the hours go quiet.
            </h2>
          </Reveal>

          <ul className="mt-14 space-y-8">
            {featured.map((t) => (
              <Reveal key={t.name} delay={0.2}>
                <li className="border-t border-line pt-6">
                  <p className="text-[0.72rem] uppercase tracking-[0.2em] text-ink-soft">
                    {t.duration} · {t.price}
                  </p>
                  <p className="mt-1.5 font-display text-2xl font-light text-ink">
                    {t.name}
                  </p>
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.3} className="mt-12">
            <Link
              href="/spa"
              className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors duration-300 hover:text-brass"
            >
              The full spa menu →
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
