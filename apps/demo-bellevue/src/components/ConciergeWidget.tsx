"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TIDE_EASE } from "./Reveal";

const OPEN_EVENT = "bellevue:open-concierge";

export function openConciergeWidget() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// Visual placement only (docs/19 §7). The real product's chat pipeline and
// embeddable widget script don't exist yet (Sprint 1 / Sprint 3) — this
// stub demonstrates where and how it should appear, not a working
// conversation. It intentionally says so rather than faking a live agent.
export function ConciergeWidget() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => {
      setVisible(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Bellevue Hotel concierge"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: TIDE_EASE }}
            className="mb-4 w-[min(22rem,calc(100vw-3rem))] border border-line bg-sand p-6 shadow-[0_8px_40px_rgba(20,28,26,0.16)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/50 font-display text-lg italic text-brass"
                >
                  B
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">
                    Bellevue Hotel Concierge
                  </p>
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-ink-soft">
                    Usually replies within moments
                  </p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close concierge"
                className="text-ink-soft transition-colors hover:text-brass"
              >
                ✕
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Good evening — I&rsquo;m here for anything about your stay: rooms,
              dining, the spa, or the days ahead.
            </p>
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-soft/80">
              Preview only — this demo property isn&rsquo;t yet connected to a
              live Hospitality AI OS concierge.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {visible && !open ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.6, ease: TIDE_EASE }}
            className="flex items-center gap-2.5 border border-brass/40 bg-sand px-5 py-3 text-[0.75rem] font-medium uppercase tracking-[0.14em] text-ink shadow-[0_4px_24px_rgba(20,28,26,0.12)] transition-colors duration-300 hover:border-brass"
          >
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full border border-brass/50 font-display text-sm italic text-brass"
            >
              B
            </span>
            Ask the concierge
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
