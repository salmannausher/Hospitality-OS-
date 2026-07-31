"use client";

// docs/08-ui-design-system.md §8/§11/§13: appears only after the 5–8s delay
// (docs/05 UX §2) — never an instant "Chat with us" bubble — and is labeled
// text, never a bare icon-only affordance.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "./Avatar";
import { resolveBrandTokens, type BrandInput } from "../tokens";

export interface LauncherProps {
  label: string;
  /** BootstrapResponse.launcherDelayMs — the real per-hotel delay from the API,
   * not a hardcoded guess. */
  delayMs: number;
  conciergeInitial: string;
  logoUrl?: string | null;
  /** Launcher renders before WidgetShell mounts, so it can't rely on
   * WidgetShell's scope for its own CSS variables — it resolves and applies
   * them itself (findings-log.md #27: without this it silently fell back to
   * whatever ambient color the host page happened to have). */
  brand: BrandInput;
  onOpen: () => void;
}

export function Launcher({ label, delayMs, conciergeInitial, logoUrl, brand, onOpen }: LauncherProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div data-hospitality-widget style={{ ...resolveBrandTokens(brand), display: "inline-block" }}>
      <AnimatePresence>
        {shown ? (
          <motion.button
            type="button"
            onClick={onOpen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid var(--neutral-300)`,
              // §8 calls this a "pill/button" loosely, but §5 is explicit that
              // radius is never 9999px ("reads as consumer messaging-app
              // styling") — radius-lg is the softest the scale actually allows.
              borderRadius: "var(--radius-lg)",
              background: "var(--neutral-0)",
              padding: "10px 18px",
              fontFamily: "var(--font-body)",
              fontSize: "var(--type-sm)",
              color: "var(--neutral-900)",
              cursor: "pointer",
              boxShadow: "var(--shadow-lifted)",
            }}
          >
            <Avatar initial={conciergeInitial} logoUrl={logoUrl} size="sm" />
            {label}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
