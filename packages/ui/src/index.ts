// @hospitality/ui — the guest widget component library for whichever UI
// Design System option was chosen (docs/08-ui-design-system.md). Resolved:
// Option A's architecture (per-hotel BrandSettings mechanism, §1) carrying
// Bellevue's real shipped materials as its first tenant (brass, Cormorant
// Garamond + Work Sans — findings-log.md #25/#26). Option D's behavior layer
// (moments/registers/tempo) is deliberately not built here — Sprint 5 ticket 6,
// "if time allows," layers on without touching anything in this package.
//
// Scope of this pass (Sprint 5 ticket 2): the guest widget only. Admin portal
// components (docs/08 §9) are a separate, not-yet-scheduled pass.

export { resolveBrandTokens, TONE_PRESETS } from "./tokens";
export type { BrandInput, TonePreset } from "./tokens";

export { Avatar } from "./components/Avatar";
export type { AvatarProps } from "./components/Avatar";

export { TypingIndicator } from "./components/TypingIndicator";

export { Launcher } from "./components/Launcher";
export type { LauncherProps } from "./components/Launcher";

export { WidgetShell } from "./components/WidgetShell";
export type { WidgetShellProps } from "./components/WidgetShell";

export { ConciergeMessage } from "./components/ConciergeMessage";
export type { ConciergeMessageProps } from "./components/ConciergeMessage";

export { GuestMessage } from "./components/GuestMessage";
export type { GuestMessageProps } from "./components/GuestMessage";

export { RecommendationCard, RecommendationCardRow } from "./components/RecommendationCard";
export type { RecommendationCardData } from "./components/RecommendationCard";

export { SuggestedChip } from "./components/SuggestedChip";
export type { SuggestedChipProps } from "./components/SuggestedChip";

export { YesNoConfirm } from "./components/YesNoConfirm";
export type { YesNoConfirmProps } from "./components/YesNoConfirm";

export { EscalationPanel } from "./components/EscalationPanel";
export type {
  EscalationPanelProps,
  EscalationChoice,
  EscalationContact,
} from "./components/EscalationPanel";
