import type { Metadata } from "next";
import { PageBanner } from "@/components/subpages/PageBanner";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { DINING } from "@/lib/content";
import { IMG } from "@/lib/images";

export const metadata: Metadata = {
  title: "Dining — Bellevue Hotel",
  description: "The Rooftop at Bellevue and Palm Terrace — dining at Bellevue Hotel.",
};

export default function DiningPage() {
  return (
    <>
      <PageBanner
        eyebrow="Dining"
        title="The rhythm of the day."
        subtitle="Two rooms, two moods — dusk on the rooftop, mornings on the terrace."
        imageId={IMG.diningRooftop}
        alt="The Rooftop at Bellevue at dusk"
      />

      <section className="px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-6xl space-y-24 md:space-y-32">
          {DINING.map((venue, i) => (
            <Reveal key={venue.name}>
              <article className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
                <div
                  className={`lg:col-span-7 ${i % 2 === 1 ? "lg:col-start-6" : ""}`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <TreatedImage
                      id={IMG[venue.image]}
                      alt={venue.name}
                      width={1200}
                      className="h-full w-full"
                    />
                  </div>
                </div>
                <div
                  className={`lg:col-span-4 ${
                    i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-9"
                  }`}
                >
                  <h2 className="font-display text-3xl font-light italic text-ink">
                    {venue.name}
                  </h2>
                  <p className="mt-4 leading-relaxed text-ink-soft">
                    {venue.cuisine}. {venue.hours}. {venue.dress}.
                  </p>
                  <p className="mt-4 text-sm text-ink-soft">{venue.note}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
