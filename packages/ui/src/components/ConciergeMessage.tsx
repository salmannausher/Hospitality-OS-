// docs/08-ui-design-system.md §8: "No bubble. Full-width text block,
// left-aligned, avatar shown once per turn — reads like a note from staff,
// not a chat-app speech balloon." The single biggest visual differentiator
// from a generic chatbot, so this component stays deliberately plain.

import { Avatar } from "./Avatar";
import { TypingIndicator } from "./TypingIndicator";

export interface ConciergeMessageProps {
  text: string;
  /** Only the first message of a turn shows the avatar (docs/08 §8). */
  showAvatar: boolean;
  conciergeInitial: string;
  logoUrl?: string | null;
  /** True while streaming hasn't produced any text yet. */
  pending?: boolean;
}

export function ConciergeMessage({
  text,
  showAvatar,
  conciergeInitial,
  logoUrl,
  pending,
}: ConciergeMessageProps) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
      <div style={{ width: 32, flexShrink: 0 }}>
        {showAvatar ? <Avatar initial={conciergeInitial} logoUrl={logoUrl} /> : null}
      </div>
      <div
        style={{
          fontSize: "var(--type-md)",
          lineHeight: "var(--line-height-body)",
          color: "var(--neutral-900)",
          maxWidth: "100%",
        }}
      >
        {pending && !text ? <TypingIndicator /> : text}
      </div>
    </div>
  );
}
