import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { IMG } from "@/lib/images";

const PLATES = [
  {
    id: IMG.introCove,
    alt: "Morning light over the water at Bellevue Cove",
    caption: "Morning, the cove",
    size: "large",
  },
  {
    id: IMG.galleryPool,
    alt: "The pool at Bellevue Hotel, lit at dusk",
    caption: undefined,
    size: "small",
  },
  {
    id: IMG.galleryBrass,
    alt: "Brass lighting detail inside Bellevue Hotel",
    caption: "A detail, the lobby",
    size: "small",
  },
  {
    id: IMG.galleryQuiet,
    alt: "A quiet morning — coffee and a book left open",
    caption: undefined,
    size: "small",
  },
  {
    id: IMG.galleryStone,
    alt: "Limestone and brick, an architectural detail at Bellevue Hotel",
    caption: undefined,
    size: "small",
  },
  {
    id: IMG.heroDusk,
    alt: "The same horizon from the hotel's arrival, later in the day",
    caption: "The horizon, again",
    size: "large",
  },
] as const;

export function Gallery() {
  return (
    <section aria-label="Bellevue Hotel, in photographs" className="bg-sand py-28 md:py-40">
      <div className="mx-auto flex max-w-5xl flex-col gap-20 px-6 md:gap-28 md:px-10">
        {PLATES.map((plate, i) => (
          <Reveal
            key={plate.alt}
            delay={0.05}
            className={i % 2 === 1 ? "self-end" : "self-start"}
          >
            <figure
              className={
                plate.size === "large"
                  ? "w-full"
                  : "w-full max-w-md md:max-w-lg"
              }
            >
              <div
                className={`overflow-hidden ${
                  plate.size === "large" ? "aspect-[16/10]" : "aspect-[4/5]"
                }`}
              >
                <TreatedImage
                  id={plate.id}
                  alt={plate.alt}
                  width={plate.size === "large" ? 1600 : 900}
                  className="h-full w-full"
                />
              </div>
              {plate.caption ? (
                <figcaption className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">
                  {plate.caption}
                </figcaption>
              ) : null}
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
