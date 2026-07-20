import Image from "next/image";
import { unsplashSrc } from "@/lib/images";

// Wraps every photograph on the site so a dozen different source images
// read as one hotel's photography (docs/18 §2 "one house look"). Never use
// next/image directly for content photography — always through here.
export function TreatedImage({
  id,
  alt,
  width,
  fill,
  priority,
  className,
  sizes,
}: {
  id: string;
  alt: string;
  width?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const w = width ?? 1600;
  if (fill) {
    return (
      <Image
        src={unsplashSrc(id, w)}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "100vw"}
        className={`photo-treated object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <Image
      src={unsplashSrc(id, w)}
      alt={alt}
      width={w}
      height={Math.round(w * 0.75)}
      priority={priority}
      sizes={sizes}
      className={`photo-treated object-cover ${className ?? ""}`}
    />
  );
}
