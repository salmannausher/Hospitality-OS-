"use client";

// docs/08-ui-design-system.md §8: "Outlined, radius-sm, motion-micro on tap —
// never filled/loud, they're a suggestion, not a primary action." Shared by
// both suggested-question chips and the quick-start/persona selector
// (docs/05 UX §2) — same visual component, different label/handler.

import { motion } from "motion/react";

export interface SuggestedChipProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function SuggestedChip({ label, onClick, disabled }: SuggestedChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{
        border: "1px solid var(--neutral-300)",
        borderRadius: "var(--radius-sm)",
        background: "transparent",
        padding: "6px 12px",
        fontSize: "var(--type-sm)",
        color: "var(--neutral-900)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </motion.button>
  );
}
