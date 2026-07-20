"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// A tide-like ease, held everywhere for coherence (docs/18 §4: "one motion
// vocabulary, repeated with discipline"). Slower than a typical SaaS reveal —
// when timing is in doubt, this codebase's rule is to go slower, not faster.
export const TIDE_EASE = [0.19, 1, 0.22, 1] as const;

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "span";
}) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 1.1, delay, ease: TIDE_EASE }}
    >
      {children}
    </Component>
  );
}
