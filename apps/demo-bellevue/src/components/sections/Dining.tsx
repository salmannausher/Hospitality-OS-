import Link from "next/link";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { DINING } from "@/lib/content";
import { IMG } from "@/lib/images";

export function Dining() {
  const [rooftop, palmTerrace] = DINING;

  return (
    <section aria-labelledby="dining-heading" className="bg-ink text-sand">
      <div className="relative">
        <div className="relative h-[70vh] min-h-[520px] w-full overflow-hidden md:h-[85vh]">
          <TreatedImage
            id={IMG[rooftop.image]}
            alt="The Rooftop at Bellevue at dusk, warm light over the water"
            fill
            sizes="100vw"
            className="object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-14 md:px-10 md:pb-20">
            <div className="mx-auto max-w-7xl">
              <Reveal>
                <Eyebrow tone="dark">Dining</Eyebrow>
              </Reveal>
              <Reveal delay={0.1}>
                <h2
                  id="dining-heading"
                  className="mt-5 max-w-xl font-display text-4xl font-light italic leading-tight md:text-5xl"
                >
                  {rooftop.name}
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="mt-4 max-w-md leading-relaxed text-sand/85">
                  {rooftop.cuisine}. {rooftop.hours}. {rooftop.note}
                </p>
              </Reveal>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
          <Reveal>
            <div className="grid gap-8 border-t border-sand/15 pt-10 md:grid-cols-[1fr_2fr] md:items-center">
              <h3 className="font-display text-2xl font-light italic">
                {palmTerrace.name}
              </h3>
              <p className="leading-relaxed text-sand/80">
                {palmTerrace.cuisine} — {palmTerrace.hours.toLowerCase()}.{" "}
                {palmTerrace.note}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <Link
              href="/dining"
              className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-brass-light transition-colors duration-300 hover:text-sand"
            >
              Dining at Bellevue →
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
