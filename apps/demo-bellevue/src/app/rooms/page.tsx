import type { Metadata } from "next";
import { PageBanner } from "@/components/subpages/PageBanner";
import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { TextLink } from "@/components/CtaLink";
import { ROOMS } from "@/lib/content";
import { IMG } from "@/lib/images";

export const metadata: Metadata = {
  title: "Rooms & Suites — Bellevue Hotel",
  description: "Five room types at Bellevue Hotel, from the Garden Room to the Presidential Suite.",
};

export default function RoomsPage() {
  return (
    <>
      <PageBanner
        eyebrow="Rooms & Suites"
        title="Five ways to stay."
        subtitle="Each room quiet in its own way — from the garden to the ocean's edge."
        imageId={IMG.roomOceanView}
        alt="An elegant hotel room at Bellevue Hotel"
      />

      <section className="px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-6xl space-y-24 md:space-y-32">
          {ROOMS.map((room, i) => (
            <Reveal key={room.slug}>
              <article
                id={room.slug}
                className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-12 lg:gap-8"
              >
                <div
                  className={`lg:col-span-7 ${
                    i % 2 === 1 ? "lg:col-start-6" : ""
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <TreatedImage
                      id={IMG[room.image]}
                      alt={`${room.name} at Bellevue Hotel`}
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
                    {room.name}
                  </h2>
                  {room.accessible ? (
                    <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-sea">
                      Fully accessible · Roll-in shower
                    </p>
                  ) : null}
                  <p className="mt-4 leading-relaxed text-ink-soft">
                    {room.feeling}
                  </p>
                  <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm text-ink-soft">
                    <div className="flex justify-between gap-4">
                      <dt>View</dt>
                      <dd className="text-ink">{room.view}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Sleeps</dt>
                      <dd className="text-ink">{room.capacity}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Beds</dt>
                      <dd className="text-ink">{room.beds}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Rate</dt>
                      <dd className="text-ink">{room.rate} / night</dd>
                    </div>
                  </dl>
                  <div className="mt-6">
                    <TextLink href="/reserve">Reserve this room</TextLink>
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
