import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";
import { IMG } from "@/lib/images";

export function Introduction() {
  return (
    <section aria-labelledby="introduction-heading" className="px-6 py-28 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <Reveal>
            <Eyebrow>Since 1968</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              id="introduction-heading"
              className="mt-8 max-w-xl font-display text-3xl font-light leading-[1.35] text-ink md:text-4xl"
            >
              Bellevue Hotel has stood at the edge of Bellevue Cove as the
              coastline&rsquo;s quiet constant — a five-star retreat built
              around unhurried service and a view that hasn&rsquo;t needed to
              change in fifty years.
            </h2>
          </Reveal>
          <Reveal delay={0.2} className="mt-10 border-t border-line pt-6">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-ink-soft">
              Est. 1968 · Five stars · {`Bellevue Cove`}
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.3} className="lg:col-span-4 lg:col-start-9">
          <figure className="lg:mt-16">
            <div className="aspect-[4/5] w-full overflow-hidden">
              <TreatedImage
                id={IMG.introCove}
                alt="Sunrise over the water at Bellevue Cove, birds crossing a pale morning sky"
                width={800}
                className="h-full w-full"
              />
            </div>
            <figcaption className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">
              The cove, morning
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
