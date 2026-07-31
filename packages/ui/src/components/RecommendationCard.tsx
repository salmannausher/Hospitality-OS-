"use client";

// docs/08-ui-design-system.md §8: "Photo, name, one-line hook, brand-primary
// accent border, radius-md. Max one per turn, 2–3 in a horizontally-
// scrollable set for bundles" (docs/05 UX §3).

import { motion } from "motion/react";

export interface RecommendationCardData {
  entityType: string;
  entityId: string;
  title: string;
  hook: string;
  imageUrl?: string;
  linkUrl?: string;
}

export function RecommendationCard({ title, hook, imageUrl, linkUrl }: RecommendationCardData) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{
        minWidth: 200,
        maxWidth: 240,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--brand-primary)",
        overflow: "hidden",
        background: "var(--neutral-0)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: 96,
          background: imageUrl
            ? `center / cover no-repeat url(${imageUrl})`
            : "var(--neutral-300)",
        }}
      />
      <div style={{ padding: "var(--space-3)" }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            letterSpacing: "var(--display-letter-spacing)",
            fontSize: "var(--type-md)",
            color: "var(--neutral-900)",
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "var(--type-sm)",
            color: "var(--neutral-600)",
            lineHeight: "var(--line-height-body)",
          }}
        >
          {hook}
        </p>
      </div>
    </motion.div>
  );

  if (!linkUrl) return content;

  return (
    <a href={linkUrl} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </a>
  );
}

/** 2–3 cards in a bundle render side by side, horizontally scrollable —
 * never a grid (docs/08 §13 Do/Don't: "one recommendation card per turn... a
 * grid/list of many options at once" is the explicit Don't). */
export function RecommendationCardRow({ cards }: { cards: RecommendationCardData[] }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", overflowX: "auto", paddingBottom: 2 }}>
      {cards.map((card) => (
        <RecommendationCard key={card.entityId} {...card} />
      ))}
    </div>
  );
}
