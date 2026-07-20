"use client";

import { motion } from "motion/react";
import { TreatedImage } from "@/components/TreatedImage";
import { IMG } from "@/lib/images";
import { PROPERTY } from "@/lib/content";
import { TIDE_EASE } from "@/components/Reveal";

function fade(delay: number) {
  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1.2, delay, ease: TIDE_EASE },
  };
}

export function Hero() {
  return (
    <section
      aria-label="Bellevue Hotel — introduction"
      className="relative flex min-h-svh items-end overflow-hidden"
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: 3, ease: TIDE_EASE }}
      >
        <TreatedImage
          id={IMG.heroMorning}
          alt="A calm, unbroken horizon where the sea meets the sky at Bellevue Cove"
          fill
          priority
          sizes="100vw"
          className="object-[center_70%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/30 to-transparent"
        />
      </motion.div>

      <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-40 md:px-10 md:pb-28">
        <motion.p
          {...fade(0.3)}
          className="text-[0.72rem] font-medium uppercase tracking-[0.3em] text-sand"
        >
          Oceanfront · Bellevue Cove
        </motion.p>
        <motion.h1
          {...fade(0.5)}
          className="mt-6 max-w-3xl font-display text-[clamp(3rem,9vw,6.5rem)] font-light italic leading-[0.98] text-sand"
        >
          {PROPERTY.name}
        </motion.h1>
        <motion.p
          {...fade(0.75)}
          className="mt-6 max-w-md text-lg leading-relaxed text-sand/90"
        >
          The coastline&rsquo;s quiet constant, since 1968.
        </motion.p>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brass-light/70 to-transparent"
      />
    </section>
  );
}
