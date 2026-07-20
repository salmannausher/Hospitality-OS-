import type { Metadata } from "next";
import { PageBanner } from "@/components/subpages/PageBanner";
import { Reveal } from "@/components/Reveal";
import { SPA_TREATMENTS } from "@/lib/content";
import { IMG } from "@/lib/images";

export const metadata: Metadata = {
  title: "Spa & Wellness — Bellevue Hotel",
  description: "The full treatment menu at Bellevue Spa & Wellness Center.",
};

export default function SpaPage() {
  return (
    <>
      <PageBanner
        eyebrow="Spa & Wellness"
        title="Let the hours go quiet."
        subtitle="Bellevue Spa & Wellness Center — the full treatment menu."
        imageId={IMG.spaTreatment}
        alt="A treatment room at Bellevue Spa & Wellness Center"
      />

      <section className="px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-3xl">
          <dl className="divide-y divide-line border-t border-line">
            {SPA_TREATMENTS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.05}>
                <div className="flex flex-col gap-1 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <div>
                    <dt className="font-display text-xl font-light italic text-ink">
                      {t.name}
                    </dt>
                    {"note" in t && t.note ? (
                      <dd className="mt-1 text-sm text-ink-soft">{t.note}</dd>
                    ) : null}
                  </div>
                  <dd className="whitespace-nowrap text-[0.72rem] uppercase tracking-[0.18em] text-ink-soft">
                    {t.duration} · {t.price}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
