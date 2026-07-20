"use client";

import { motion } from "motion/react";
import { CtaLink } from "./CtaLink";
import { EASE_OUT } from "./Reveal";

function fade(delay: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1, delay, ease: EASE_OUT },
  };
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-svh flex-col justify-center px-6 pt-24 pb-16"
    >
      <div className="mx-auto w-full max-w-6xl">
        <motion.p
          {...fade(0.1)}
          className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-brass"
        >
          For luxury hotels, resorts & the agencies who serve them
        </motion.p>

        <motion.h1
          {...fade(0.25)}
          className="mt-8 font-display text-[clamp(3rem,8vw,6.75rem)] font-light leading-[1.02] tracking-[-0.02em]"
        >
          Software that behaves
          <br className="hidden md:block" /> like{" "}
          <em className="italic text-brass">staff</em>.
        </motion.h1>

        <motion.p
          {...fade(0.4)}
          className="mt-9 max-w-2xl text-lg leading-relaxed text-ink-soft"
        >
          Hospitality AI OS learns your property the way a new concierge would —
          then answers every guest with the certainty of someone who has worked
          your desk for years. Grounded in what you actually offer. Never
          guessing.
        </motion.p>

        <motion.div {...fade(0.55)} className="mt-12 flex flex-wrap gap-4">
          <CtaLink href="#book">Book a demo</CtaLink>
          <CtaLink href="#demo" variant="outline">
            See how it thinks
          </CtaLink>
        </motion.div>

        <motion.div
          {...fade(0.8)}
          className="mt-24 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-[0.68rem] uppercase tracking-[0.2em] text-ink-soft md:mt-32"
        >
          <span>Before · during · after the stay</span>
          <span className="hidden md:inline">Every language, every hour</span>
          <span>Always in your voice</span>
        </motion.div>
      </div>
    </section>
  );
}
