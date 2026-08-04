// docs/08-ui-design-system.md §1/§8/§11: the panel root. Applies the resolved
// per-hotel/per-preset CSS variables (tokens.ts) plus tokens.css's fixed scale
// via `data-hospitality-widget`, so every component below reads var(--...)
// without knowing which hotel or preset it's rendering for.

import { Children, type CSSProperties, type ReactNode } from "react";
import { resolveBrandTokens, type BrandInput } from "../tokens";
import { Avatar } from "./Avatar";

export interface WidgetShellProps {
  conciergeName: string;
  hotelName: string;
  brand: BrandInput;
  logoUrl?: string | null;
  /** Monogram letter for the header avatar — defaults to conciergeName's
   * first letter, but a conciergeName like "The Bellevue Concierge" makes
   * that read as "T" rather than the hotel's own initial. Pass explicitly to
   * keep it consistent with whatever initial ConciergeMessage uses for the
   * same character elsewhere in the thread. */
  avatarInitial?: string;
  /** The scrollable message thread — ConciergeMessage/GuestMessage/
   * RecommendationCard/etc. children, in order. */
  children: ReactNode;
  /** The input bar — kept as a slot rather than a fixed <input>, since the
   * real send/streaming logic belongs to the app embedding this shell, not
   * to the design-system package (docs/12 Engineering Conventions §2). */
  inputBar: ReactNode;
  /** Persistent CTA area (docs/05 UX §6) — e.g. a "Book now" link. Optional:
   * not every turn has one. */
  ctaArea?: ReactNode;
  onClose?: () => void;
  /** docs/08 §11: "Mobile (<768px): full-screen takeover on open — no
   * floating box." The embedding app decides when it's mobile (a matchMedia
   * check) and passes this through; WidgetShell just renders accordingly. */
  fullscreen?: boolean;
}

export function WidgetShell({
  conciergeName,
  hotelName,
  brand,
  logoUrl,
  avatarInitial,
  children,
  inputBar,
  ctaArea,
  onClose,
  fullscreen,
}: WidgetShellProps) {
  const brandStyle = resolveBrandTokens(brand);

  const rootStyle: CSSProperties = fullscreen
    ? {
        ...brandStyle,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        maxHeight: "none",
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
      }
    : {
        ...brandStyle,
        display: "flex",
        flexDirection: "column",
        width: "min(24rem, 100%)",
        height: "min(70vh, 640px)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--neutral-300)",
        boxShadow: "var(--shadow-lifted)",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
      };

  return (
    <div data-hospitality-widget style={rootStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-4) var(--space-4) var(--space-3)",
          borderBottom: "1px solid var(--neutral-100)",
        }}
      >
        <Avatar initial={avatarInitial ?? conciergeName} logoUrl={logoUrl} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              letterSpacing: "var(--display-letter-spacing)",
              fontSize: "var(--type-md)",
              color: "var(--neutral-900)",
            }}
          >
            {conciergeName}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "var(--type-xs)",
              color: "var(--neutral-600)",
            }}
          >
            {hotelName}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close concierge"
            style={{
              background: "none",
              border: "none",
              color: "var(--neutral-600)",
              cursor: "pointer",
              fontSize: "var(--type-md)",
              lineHeight: 1,
              padding: "var(--space-1)",
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        {/* Each turn (message, RecommendationCardRow, YesNoConfirm, ...) needs
         * flexShrink: 0 here — without it, a flex column child defaults to
         * flexShrink: 1, so once total thread content exceeds this panel's
         * fixed height, the browser SHRINKS every child proportionally to
         * fit instead of leaving them at natural height and actually
         * scrolling (which overflowY: auto is here to do). A
         * RecommendationCardRow's real ~150-200px got compressed to ~20px
         * this way — its cards rendered fully in the DOM, just squeezed to
         * a sliver, easy to mistake for a stray divider line rather than a
         * collapsed card (findings-log.md #49). */}
        {Children.toArray(children).map((child, i) => (
          <div key={i} style={{ flexShrink: 0 }}>
            {child}
          </div>
        ))}
      </div>

      {ctaArea ? (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderTop: "1px solid var(--neutral-100)",
          }}
        >
          {ctaArea}
        </div>
      ) : null}

      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          borderTop: "1px solid var(--neutral-100)",
        }}
      >
        {inputBar}
      </div>
    </div>
  );
}
