import { TreatedImage } from "@/components/TreatedImage";
import { Reveal } from "@/components/Reveal";
import { Eyebrow } from "@/components/Eyebrow";

export function PageBanner({
  eyebrow,
  title,
  subtitle,
  imageId,
  alt,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageId: string;
  alt: string;
}) {
  return (
    <section aria-label={title} className="relative flex h-[60vh] min-h-[420px] items-end overflow-hidden">
      <TreatedImage id={imageId} alt={alt} fill priority sizes="100vw" />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/30 to-transparent"
      />
      <div className="relative mx-auto w-full max-w-7xl px-6 pb-14 md:px-10 md:pb-20">
        <Reveal>
          <Eyebrow tone="dark">{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={0.1}>
          <h1 className="mt-5 font-display text-5xl font-light italic leading-tight text-sand md:text-6xl">
            {title}
          </h1>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-4 max-w-lg text-sand/85">{subtitle}</p>
        </Reveal>
      </div>
    </section>
  );
}
