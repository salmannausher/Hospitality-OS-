"use client";

// docs/08-ui-design-system.md §8: "Distinct card treatment (subtle border, no
// accent color — deliberately calmer than a recommendation card... reads as
// 'we're taking this seriously,' not 'here's another option')" (docs/05 UX §5).

import { useState } from "react";

export type EscalationChoice = "connect_now" | "contact_me";

export interface EscalationContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface EscalationPanelProps {
  reason: string;
  options: EscalationChoice[];
  /** API §2.3 comment: always false in V1 — no live-staff channel exists yet,
   * so `connect_now` is never actually offered even if present in `options`. */
  liveStaffAvailable: boolean;
  onSubmit: (choice: EscalationChoice, contact: EscalationContact | null) => void;
  submitting?: boolean;
  resultMessage?: string | null;
}

export function EscalationPanel({
  reason,
  options,
  liveStaffAvailable,
  onSubmit,
  submitting,
  resultMessage,
}: EscalationPanelProps) {
  const [collectingContact, setCollectingContact] = useState(false);
  const [contact, setContact] = useState<EscalationContact>({});

  const canConnectNow = liveStaffAvailable && options.includes("connect_now");
  const canContactMe = options.includes("contact_me");

  if (resultMessage) {
    return (
      <div style={panelStyle}>
        <p style={bodyTextStyle}>{resultMessage}</p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <p style={bodyTextStyle}>{reason}</p>

      {!collectingContact ? (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          {canConnectNow ? (
            <button
              type="button"
              onClick={() => onSubmit("connect_now", null)}
              disabled={submitting}
              style={buttonStyle}
            >
              Connect me now
            </button>
          ) : null}
          {canContactMe ? (
            <button
              type="button"
              onClick={() => setCollectingContact(true)}
              disabled={submitting}
              style={buttonStyle}
            >
              Email or call me back
            </button>
          ) : null}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit("contact_me", contact);
          }}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-3)" }}
        >
          <input
            value={contact.name ?? ""}
            onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            placeholder="Name"
            style={inputStyle}
          />
          <input
            value={contact.email ?? ""}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            placeholder="Email"
            type="email"
            style={inputStyle}
          />
          <input
            value={contact.phone ?? ""}
            onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            placeholder="Phone (optional)"
            style={inputStyle}
          />
          <button type="submit" disabled={submitting} style={buttonStyle}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

const panelStyle = {
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--neutral-300)",
  padding: "var(--space-4)",
  background: "var(--neutral-0)",
} as const;

const bodyTextStyle = {
  margin: 0,
  fontSize: "var(--type-md)",
  lineHeight: "var(--line-height-body)",
  color: "var(--neutral-900)",
} as const;

const buttonStyle = {
  border: "1px solid var(--neutral-300)",
  borderRadius: "var(--radius-sm)",
  background: "var(--neutral-0)",
  color: "var(--neutral-900)",
  padding: "8px 14px",
  fontSize: "var(--type-sm)",
  cursor: "pointer",
} as const;

const inputStyle = {
  border: "none",
  borderBottom: "1px solid var(--neutral-300)",
  background: "transparent",
  padding: "6px 2px",
  fontSize: "var(--type-sm)",
  color: "var(--neutral-900)",
  outline: "none",
} as const;
