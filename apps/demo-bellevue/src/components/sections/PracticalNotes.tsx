"use client";

import { Reveal } from "@/components/Reveal";
import { POLICIES } from "@/lib/content";
import { openConciergeWidget } from "@/components/ConciergeWidget";

export function PracticalNotes() {
  return (
    <section
      id="practical-notes"
      aria-labelledby="practical-notes-heading"
      className="border-y border-line bg-stone/60 px-6 py-16 md:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <h2 id="practical-notes-heading" className="sr-only">
          Practical notes
        </h2>
        <Reveal>
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {POLICIES.map((p) => (
              <div key={p.label}>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brass">
                  {p.label}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {p.detail}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal delay={0.1} className="mt-10 border-t border-line pt-6 text-center">
          <p className="text-sm text-ink-soft">
            Anything else — our concierge is here at any hour.{" "}
            <button
              type="button"
              onClick={openConciergeWidget}
              className="font-medium text-brass underline underline-offset-4 transition-colors hover:text-ink"
            >
              Ask now
            </button>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
