// @hospitality/ui — the runtime brand-resolution mechanism (docs/08-ui-design-system.md
// §1: "every themeable value is a CSS variable, resolved at runtime, not at build time").
//
// Fixed tokens (neutral scale, semantic colors, spacing, type scale, motion) live in
// tokens.css and never change. This file resolves the two things that DO vary:
//   - tonePreset (BrandSettings.tonePreset) → a named bucket of radius/type-pairing defaults
//   - primaryColor / secondaryColor / fontFamily (BrandSettings, freeform per hotel)
// into a single CSSProperties object a WidgetShell spreads onto its root element.

import type { CSSProperties } from "react";

export type TonePreset =
  | "CLASSIC_LUXURY"
  | "MODERN_LUXURY"
  | "BOUTIQUE"
  | "FAMILY_FRIENDLY";

interface PresetDefaults {
  /** §2 table's radius range, resolved to a concrete trio (findings-log.md #26). */
  radius: { sm: number; md: number; lg: number };
  /** §4: "display text in the Classic Luxury and Modern Luxury presets gets
   * slight positive tracking" — the other two presets don't. */
  displayLetterSpacing: boolean;
  /** Fallback accent when a hotel hasn't set BrandSettings.primaryColor yet —
   * never shown to a guest in practice, only used so the widget never renders
   * with an undefined accent while a hotel's brand settings are mid-setup. */
  fallbackPrimary: string;
  fallbackSecondary: string;
  /** Fallback display/body font stacks — a real hotel overrides these via
   * BrandSettings.fontFamily (display only, see the module comment below) and
   * the app's own next/font loading; these are just a sane, license-free default. */
  fallbackDisplayFont: string;
  fallbackBodyFont: string;
}

export const TONE_PRESETS: Record<TonePreset, PresetDefaults> = {
  CLASSIC_LUXURY: {
    radius: { sm: 8, md: 10, lg: 12 },
    displayLetterSpacing: true,
    fallbackPrimary: "#6b6459",
    fallbackSecondary: "#8c8676",
    fallbackDisplayFont: "Georgia, 'Iowan Old Style', serif",
    fallbackBodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  MODERN_LUXURY: {
    radius: { sm: 8, md: 10, lg: 12 },
    displayLetterSpacing: true,
    fallbackPrimary: "#6b6459",
    fallbackSecondary: "#8c8676",
    fallbackDisplayFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fallbackBodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  BOUTIQUE: {
    radius: { sm: 12, md: 14, lg: 16 },
    displayLetterSpacing: false,
    fallbackPrimary: "#8c6f4a",
    fallbackSecondary: "#a38a63",
    fallbackDisplayFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fallbackBodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  FAMILY_FRIENDLY: {
    radius: { sm: 12, md: 14, lg: 16 },
    displayLetterSpacing: false,
    fallbackPrimary: "#5b8a6b",
    fallbackSecondary: "#7fa98f",
    fallbackDisplayFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fallbackBodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

export interface BrandInput {
  tonePreset: TonePreset;
  /** BrandSettings.primaryColor — accent only: avatar ring, CTA, active states,
   * card border. Never a full-bleed background (docs/08 §3). */
  primaryColor?: string | null;
  secondaryColor?: string | null;
  /** BrandSettings.fontFamily overrides the *display* face only (concierge
   * name, headings) — body text stays the preset's clean-sans default unless
   * the embedding app supplies its own via `bodyFontStack` below. A single
   * schema field can't hold both; see findings-log.md #26. */
  displayFontStack?: string | null;
  /** Not a BrandSettings field — an app-level override for when the
   * embedding site has already loaded a matching body face locally (e.g. the
   * Bellevue demo site's own Work Sans) rather than falling back to a
   * generic system-sans stack. */
  bodyFontStack?: string | null;
}

/** Spread the result onto the widget root's `style` prop, alongside
 * `data-hospitality-widget` (which tokens.css targets) and the resolved
 * tonePreset's letter-spacing flag applied by ConciergeName directly. */
export function resolveBrandTokens(brand: BrandInput): CSSProperties & Record<string, string> {
  const preset = TONE_PRESETS[brand.tonePreset] ?? TONE_PRESETS.MODERN_LUXURY;

  return {
    "--brand-primary": brand.primaryColor || preset.fallbackPrimary,
    "--brand-secondary": brand.secondaryColor || preset.fallbackSecondary,
    "--font-display": brand.displayFontStack || preset.fallbackDisplayFont,
    "--font-body": brand.bodyFontStack || preset.fallbackBodyFont,
    "--radius-sm": `${preset.radius.sm}px`,
    "--radius-md": `${preset.radius.md}px`,
    "--radius-lg": `${preset.radius.lg}px`,
    "--display-letter-spacing": preset.displayLetterSpacing ? "0.02em" : "normal",
  };
}
