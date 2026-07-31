"use client";

// docs/08-ui-design-system.md §6/§8: "single pulsing glyph, not three bouncing
// dots" — the one animation in this package that runs on an infinite loop, so
// it's the one place §8's Do/Don't table is checked most directly.

import { motion } from "motion/react";

export function TypingIndicator() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <motion.span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--brand-primary)",
          display: "inline-block",
        }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        style={{
          fontSize: "var(--type-xs)",
          color: "var(--neutral-600)",
          letterSpacing: "0.04em",
        }}
      >
        The concierge is composing
      </span>
    </span>
  );
}
