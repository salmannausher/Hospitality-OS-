import Link from "next/link";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { TextLink } from "@/components/CtaLink";
import { ROOMS } from "@/lib/content";
import { IMG } from "@/lib/images";

const FEATURED = ["ocean-view-suite", "garden-room", "presidential-suite"] as const;

export function Rooms() {
  const featured = FEATURED.map((slug) => ROOMS.find((r) => r.slug === slug)!);

  return (
    <section aria-labelledby="rooms-heading" className="px-6 py-28 md:px-10 md:py-40">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <Eyebrow>Signature Rooms</Eyebrow>
        </Reveal>
        <Reveal delay={0.1}>
          <h2
            id="rooms-heading"
            className="mt-6 max-w-lg font-display text-4xl font-light leading-[1.15] text-ink md:text-5xl"
          >
            A room of your own, waiting.
          </h2>
        </Reveal>

        <div className="mt-20 space-y-24 md:space-y-32">
          {featured.map((room, i) => (
            <Reveal key={room.slug} delay={0.1}>
              <article className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
                <div
                  className={`lg:col-span-7 ${
                    i % 2 === 1 ? "lg:order-2 lg:col-start-6" : "lg:order-1"
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <TreatedImage
                      id={IMG[room.image]}
                      alt={`${room.name} at Bellevue Hotel — ${room.view.toLowerCase()}`}
                      width={1200}
                      className="h-full w-full transition-transform duration-[1200ms] ease-out hover:scale-[1.03]"
                    />
                  </div>
                </div>
                <div
                  className={`lg:col-span-4 ${
                    i % 2 === 1 ? "lg:order-1 lg:col-start-1" : "lg:order-2 lg:col-start-9"
                  }`}
                >
                  <h3 className="font-display text-3xl font-light italic text-ink">
                    {room.name}
                  </h3>
                  <p className="mt-4 leading-relaxed text-ink-soft">
                    {room.feeling}
                  </p>
                  <p className="mt-5 text-[0.72rem] uppercase tracking-[0.18em] text-ink-soft">
                    {room.view} · {room.capacity} · from {room.rate.split("–")[0]}
                  </p>
                  <div className="mt-6">
                    <TextLink href={`/rooms#${room.slug}`}>
                      See this room
                    </TextLink>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15} className="mt-24 flex flex-col items-start gap-6 border-t border-line pt-10 md:flex-row md:items-center md:justify-between">
          <Link
            href="/rooms"
            className="text-[0.78rem] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors duration-300 hover:text-brass"
          >
            All rooms &amp; rates →
          </Link>
          <TextLink href="/reserve">Reserve your room</TextLink>
        </Reveal>
      </div>
    </section>
  );
}
