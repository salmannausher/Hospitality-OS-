import type { Metadata } from "next";
import { PageBanner } from "@/components/subpages/PageBanner";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { TextLink } from "@/components/CtaLink";
import { WEDDING_VENUES } from "@/lib/content";
import { IMG } from "@/lib/images";

export const metadata: Metadata = {
  title: "Weddings & Events — Bellevue Hotel",
  description: "The Grand Pavilion and Sunset Terrace at Bellevue Hotel.",
};

export default function WeddingsPage() {
  return (
    <>
      <PageBanner
        eyebrow="Weddings & Events"
        title="An occasion, held gently."
        subtitle="Two settings for the day you'll return to for the rest of your lives."
        imageId={IMG.weddingTerrace}
        alt="An oceanfront terrace at Bellevue Hotel, set for a ceremony"
      />

      <section className="px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-6xl space-y-24 md:space-y-32">
          {WEDDING_VENUES.map((venue, i) => (
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
                    {venue.detail}
                  </p>
                  <div className="mt-6">
                    <TextLink href="mailto:events@bellevuehotel.example">
                      Enquire about this space
                    </TextLink>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
