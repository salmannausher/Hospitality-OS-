// docs/08-ui-design-system.md §8: "Subtle bubble (radius-md, neutral-100
// background), right-aligned — the *only* place in the thread that looks
// like a conventional chat bubble" — deliberately, to distinguish the guest's
// own words from the concierge's.

export interface GuestMessageProps {
  text: string;
}

export function GuestMessage({ text }: GuestMessageProps) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          maxWidth: "82%",
          background: "var(--neutral-100)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-2) var(--space-3)",
          fontSize: "var(--type-md)",
          lineHeight: "var(--line-height-body)",
          color: "var(--neutral-900)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
