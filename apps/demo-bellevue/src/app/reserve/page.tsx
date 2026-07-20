import type { Metadata } from "next";
import { ReserveForm } from "@/components/subpages/ReserveForm";

export const metadata: Metadata = {
  title: "Reserve — Bellevue Hotel",
  description: "Reserve your stay at Bellevue Hotel.",
};

export default function ReservePage() {
  return (
    <section className="px-6 py-32 pt-40 md:px-10 md:py-40 md:pt-48">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-brass">
          Reserve
        </p>
        <h1 className="mt-6 font-display text-4xl font-light italic text-ink md:text-5xl">
          Let&rsquo;s hold your room.
        </h1>
        <p className="mt-5 leading-relaxed text-ink-soft">
          A few details, and the desk will confirm the rest directly with you
          — no account, no urgency, no fine print to hunt for.
        </p>
      </div>

      <ReserveForm />
    </section>
  );
}
