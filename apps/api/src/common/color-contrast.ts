/**
 * WCAG 2.0 relative-luminance contrast ratio (UI Design System §10: "WCAG AA
 * minimum... every brand-color/neutral-background combination is
 * contrast-checked before a hotel's theme goes live"). Deterministic, no
 * external dependency — a pure function, unit-tested (color-contrast.spec.ts)
 * the same way the rerank/confidence formulas are (Engineering Conventions
 * §9). See findings-log.md #17 for which color plays which role in the
 * actual Brand Settings save-time check (this module only computes the
 * ratio; `BrandSettingsService` decides which pairs to check and against
 * what threshold).
 */

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** WCAG AA's normal-text threshold — the stricter of AA's two ratios (3:1
 * applies only to large text/UI components), applied uniformly since
 * nothing at this layer distinguishes button-label size from body text. */
export const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

/** Parses `#RGB` or `#RRGGBB` into `[r, g, b]` (0–255 each), or `null` if the
 * string isn't a valid hex color. */
export function parseHexColor(value: string): [number, number, number] | null {
  if (!isValidHexColor(value)) return null;
  const hex = value.slice(1);
  if (hex.length === 3) {
    const [r, g, b] = hex.split('');
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function srgbChannelToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** The WCAG contrast ratio between two colors, from 1 (no contrast) to 21
 * (black on white). Returns `null` if either color isn't a valid hex string. */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const a = parseHexColor(hexA);
  const b = parseHexColor(hexB);
  if (!a || !b) return null;
  const lA = relativeLuminance(a);
  const lB = relativeLuminance(b);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Whether `hexA`/`hexB` meet WCAG AA's normal-text minimum (4.5:1). */
export function meetsWcagAA(hexA: string, hexB: string): boolean {
  const ratio = contrastRatio(hexA, hexB);
  return ratio !== null && ratio >= WCAG_AA_NORMAL_TEXT_RATIO;
}
