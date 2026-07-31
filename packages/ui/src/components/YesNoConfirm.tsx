// docs/08-ui-design-system.md §8: "Two buttons inline in the thread (primary
// + ghost)" — the lead-capture permission step (docs/05 UX §4).

export interface YesNoConfirmProps {
  question: string;
  onYes: () => void;
  onNo: () => void;
  yesLabel?: string;
  noLabel?: string;
  disabled?: boolean;
}

export function YesNoConfirm({
  question,
  onYes,
  onNo,
  yesLabel = "Yes, please",
  noLabel = "Not now",
  disabled,
}: YesNoConfirmProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <p
        style={{
          margin: 0,
          fontSize: "var(--type-md)",
          lineHeight: "var(--line-height-body)",
          color: "var(--neutral-900)",
        }}
      >
        {question}
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={onYes}
          disabled={disabled}
          style={{
            border: "1px solid var(--brand-primary)",
            borderRadius: "var(--radius-sm)",
            background: "var(--brand-primary)",
            color: "var(--neutral-0)",
            padding: "8px 16px",
            fontSize: "var(--type-sm)",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          onClick={onNo}
          disabled={disabled}
          style={{
            border: "1px solid var(--neutral-300)",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            color: "var(--neutral-900)",
            padding: "8px 16px",
            fontSize: "var(--type-sm)",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {noLabel}
        </button>
      </div>
    </div>
  );
}
