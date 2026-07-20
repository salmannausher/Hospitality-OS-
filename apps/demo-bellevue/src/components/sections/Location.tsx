import Link from "next/link";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { PROPERTY, LOCAL_RECOMMENDATIONS } from "@/lib/content";
import { IMG } from "@/lib/images";

const FEATURED = ["Cliffside Coastal Trail", "Harbor Row Sushi", "Marina Farmers Market"] as const;

export function Location() {
  const featured = FEATURED.map(
    (name) => LOCAL_RECOMMENDATIONS.find((r) => r.name === name)!,
  );

  return (
    <section aria-labelledby="location-heading" className="px-6 py-28 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <div className="aspect-square w-full overflow-hidden">
            <TreatedImage
              id={IMG.locationAerial}
              alt="An aerial view of the rocky coastline near Bellevue Cove"
              width={1000}
              className="h-full w-full"
            />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <Eyebrow>Bellevue Cove</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              id="location-heading"
              className="mt-6 font-display text-4xl font-light leading-tight text-ink md:text-5xl"
            >
              Easy to reach. Hard to leave.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-md text-[0.75rem] uppercase tracking-[0.16em] text-ink-soft">
              {PROPERTY.location} · {PROPERTY.airportNote}
            </p>
          </Reveal>

          <ul className="mt-12 space-y-6">
            {featured.map((rec, i) => (
              <Reveal key={rec.name} delay={0.25 + i * 0.05}>
                <li className="border-t border-line pt-5">
                  <p className="font-display text-lg italic text-ink">
                    {rec.name}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {rec.category} — {rec.note}
                  </p>
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.4} className="mt-10">
            <Link
              href="/explore"
              className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors duration-300 hover:text-brass"
            >
              Exploring the cove →
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
