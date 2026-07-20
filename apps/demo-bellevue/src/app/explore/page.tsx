import type { Metadata } from "next";
import { PageBanner } from "@/components/subpages/PageBanner";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { EXPERIENCES, LOCAL_RECOMMENDATIONS } from "@/lib/content";
import { IMG } from "@/lib/images";

export const metadata: Metadata = {
  title: "Explore — Bellevue Hotel",
  description: "Experiences at Bellevue Hotel, and the cove beyond it.",
};

export default function ExplorePage() {
  return (
    <>
      <PageBanner
        eyebrow="Explore"
        title="The days, and the cove beyond them."
        subtitle="What a stay becomes — on the property, and just past its gates."
        imageId={IMG.expSailing}
        alt="A sailing charter at sunset near Bellevue Cove"
      />

      <section className="px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {EXPERIENCES.map((exp, i) => (
              <Reveal key={exp.name} delay={i * 0.08}>
                <article>
                  <div className="aspect-[4/5] w-full overflow-hidden">
                    <TreatedImage
                      id={IMG[exp.image]}
                      alt={exp.name}
                      width={800}
                      className="h-full w-full"
                    />
                  </div>
                  <h2 className="mt-6 font-display text-xl font-light italic text-ink">
                    {exp.name}
                  </h2>
                  <p className="mt-2 text-[0.72rem] uppercase tracking-[0.16em] text-ink-soft">
                    {exp.category} · {exp.duration} · {exp.price}
                  </p>
                  <p className="mt-1 text-[0.72rem] uppercase tracking-[0.16em] text-ink-soft">
                    {exp.leadTime}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-stone px-6 py-24 md:px-10 md:py-28">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <Eyebrow>Local Recommendations</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-display text-3xl font-light italic text-ink">
              Just past the gates.
            </h2>
          </Reveal>
          <ul className="mt-12 divide-y divide-line border-t border-line">
            {LOCAL_RECOMMENDATIONS.map((rec, i) => (
              <Reveal key={rec.name} delay={0.1 + i * 0.05}>
                <li className="py-6">
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
        </div>
      </section>
    </>
  );
}
