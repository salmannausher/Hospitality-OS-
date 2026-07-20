import Link from "next/link";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { IMG } from "@/lib/images";

export function BookingInvitation() {
  return (
    <section
      aria-labelledby="booking-heading"
      className="relative flex min-h-[85vh] items-center overflow-hidden"
    >
      <div className="absolute inset-0">
        <TreatedImage
          id={IMG.heroDusk}
          alt="The same view from Bellevue Hotel's arrival, at dusk"
          fill
          sizes="100vw"
          className="object-center"
        />
        <div aria-hidden className="absolute inset-0 bg-ink/45" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-6 py-28 text-center text-sand md:px-10">
        <Reveal>
          <Eyebrow tone="dark">Come back to the cove</Eyebrow>
        </Reveal>
        <Reveal delay={0.1}>
          <h2
            id="booking-heading"
            className="mt-8 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-light italic leading-[1.05]"
          >
            Come. It&rsquo;s still here.
          </h2>
        </Reveal>
        <Reveal delay={0.2} className="mt-10">
          <Link
            href="/reserve"
            className="inline-flex h-14 items-center justify-center bg-brass-light px-10 text-[0.78rem] font-medium uppercase tracking-[0.2em] text-night transition-colors duration-300 hover:bg-sand"
          >
            Reserve your stay
          </Link>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mt-6 text-sm text-sand/80">
            Free cancellation until 48 hours before arrival.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
