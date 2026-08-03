"use client";

// Widget harness, now on the real @hospitality/ui component library
// (Sprint 5 ticket 2 — docs/08-ui-design-system.md, Option A + Bellevue's
// real materials, findings-log.md #25/#26). Still talks to the api ONLY
// through @hospitality/sdk (API-first, Engineering Conventions §1) — nothing
// about the pipeline logic below changed from the Sprint 1 harness, only how
// it renders. Now also handles every Sprint 3 SSE event (card/lead_prompt/
// escalation/cta), which the original bare-HTML harness never rendered.

import { useEffect, useRef, useState } from "react";
import {
  getBootstrap,
  sendChatMessage,
  submitLeadAnswer,
  submitEscalationChoice,
  type BootstrapResponse,
  type RecommendationCard as RecommendationCardEvent,
  type LeadField,
} from "@hospitality/sdk";
import {
  WidgetShell,
  Launcher,
  ConciergeMessage,
  GuestMessage,
  RecommendationCardRow,
  SuggestedChip,
  YesNoConfirm,
  EscalationPanel,
  type EscalationChoice,
  type EscalationContact,
} from "@hospitality/ui";

const WIDGET_KEY = "wk_demo_bellevue"; // the seeded Bellevue demo key

/** UX §4's worked example, one line per field — the second (and later) field
 * ask has no server-pushed SSE event of its own (`nextField` from `POST
 * /v1/chat/lead`'s response tells the client what to ask next, API §2.2), so
 * the client owns this wording rather than the server re-sending it. */
const LEAD_FOLLOWUP_QUESTIONS: Record<LeadField, string> = {
  dates: "Wonderful — what dates are you considering?",
  email: "And what's the best email to send it to?",
  name: "And what name should I put this under?",
  phone: "And what's the best number to reach you at?",
};

type Turn =
  | { kind: "guest"; text: string }
  | { kind: "concierge"; text: string; pending: boolean }
  | { kind: "cards"; cards: RecommendationCardEvent[] }
  | {
      kind: "leadPrompt";
      id: string;
      promptId: string;
      question: string;
      field: LeadField;
      stage: "ask" | "value" | "submitting" | "done";
      resultText?: string;
    }
  | {
      kind: "escalation";
      escalationId: string;
      reason: string;
      options: EscalationChoice[];
      liveStaffAvailable: boolean;
      submitting: boolean;
      resultMessage: string | null;
    };

export default function WidgetHarness() {
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "acking" | "streaming">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [ctaLink, setCtaLink] = useState<{ label: string; url: string } | null>(null);
  const sessionId = useRef<string>("");
  const conversationId = useRef<string | null>(null);

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    getBootstrap(WIDGET_KEY)
      .then(setBoot)
      .catch((e) => setBootError(String(e?.message ?? e)));
  }, []);

  async function send(message: string, contextTag?: string) {
    if (!message.trim() || status !== "idle") return;
    setInput("");
    setNotice(null);
    setTurns((t) => [...t, { kind: "guest", text: message }]);
    setStatus("acking");

    let conciergeIndex = -1;
    setTurns((t) => {
      conciergeIndex = t.length;
      return [...t, { kind: "concierge", text: "", pending: true }];
    });

    try {
      await sendChatMessage(
        {
          widgetKey: WIDGET_KEY,
          sessionId: sessionId.current,
          conversationId: conversationId.current,
          message,
          contextTag: contextTag ?? null,
        },
        (event) => {
          switch (event.type) {
            case "ack":
              conversationId.current = event.conversationId;
              setStatus("streaming");
              break;
            case "delta":
              setTurns((t) => {
                const next = [...t];
                const turn = next[conciergeIndex];
                if (turn.kind === "concierge") {
                  next[conciergeIndex] = { kind: "concierge", text: turn.text + event.text, pending: false };
                }
                return next;
              });
              break;
            case "card":
              setTurns((t) => [...t, { kind: "cards", cards: event.cards }]);
              break;
            case "lead_prompt":
              setTurns((t) => [
                ...t,
                {
                  kind: "leadPrompt",
                  id: event.promptId,
                  promptId: event.promptId,
                  question: event.question,
                  field: event.field,
                  stage: "ask",
                },
              ]);
              break;
            case "escalation":
              setTurns((t) => [
                ...t,
                {
                  kind: "escalation",
                  escalationId: event.escalationId,
                  reason: event.reason,
                  options: event.options,
                  liveStaffAvailable: event.liveStaffAvailable,
                  submitting: false,
                  resultMessage: null,
                },
              ]);
              break;
            case "cta":
              setCtaLink({ label: ctaLabel(event.kind), url: event.url });
              break;
            case "error":
              setNotice(event.error.message);
              break;
            case "done":
              break;
          }
        },
      );
    } catch (e) {
      setNotice(String((e as Error)?.message ?? e));
    } finally {
      setStatus("idle");
    }
  }

  function updateLeadTurn(id: string, patch: Partial<Extract<Turn, { kind: "leadPrompt" }>>) {
    setTurns((t) =>
      t.map((turn) => (turn.kind === "leadPrompt" && turn.id === id ? { ...turn, ...patch } : turn)),
    );
  }

  async function submitLead(id: string, promptId: string, field: LeadField, value: string | null, declined: boolean) {
    if (!conversationId.current) return;
    updateLeadTurn(id, { stage: "submitting" });
    try {
      const res = await submitLeadAnswer(WIDGET_KEY, {
        conversationId: conversationId.current,
        promptId,
        field,
        value,
        consent: !declined,
        declined,
      });
      updateLeadTurn(id, {
        stage: "done",
        resultText: declined ? "No trouble at all." : "Got it — thank you.",
      });
      // API §2.2: `nextField` means the multi-field ask isn't done — continue
      // in the same conversational shape (a concierge line, then the next
      // field's input) rather than stopping after the first field.
      if (!declined && res.nextField) {
        const nextField = res.nextField;
        setTurns((t) => [
          ...t,
          { kind: "concierge", text: LEAD_FOLLOWUP_QUESTIONS[nextField], pending: false },
          {
            kind: "leadPrompt",
            id: `${promptId}:${nextField}`,
            promptId,
            question: LEAD_FOLLOWUP_QUESTIONS[nextField],
            field: nextField,
            stage: "value",
          },
        ]);
      }
    } catch (e) {
      setNotice(String((e as Error)?.message ?? e));
      updateLeadTurn(id, { stage: "value" });
    }
  }

  async function submitEscalation(
    escalationId: string,
    choice: EscalationChoice,
    contact: EscalationContact | null,
  ) {
    setTurns((t) =>
      t.map((turn) => (turn.kind === "escalation" && turn.escalationId === escalationId ? { ...turn, submitting: true } : turn)),
    );
    try {
      const res = await submitEscalationChoice(WIDGET_KEY, {
        escalationId,
        choice,
        contact,
      });
      setTurns((t) =>
        t.map((turn) =>
          turn.kind === "escalation" && turn.escalationId === escalationId
            ? { ...turn, submitting: false, resultMessage: res.message }
            : turn,
        ),
      );
    } catch (e) {
      setNotice(String((e as Error)?.message ?? e));
      setTurns((t) =>
        t.map((turn) => (turn.kind === "escalation" && turn.escalationId === escalationId ? { ...turn, submitting: false } : turn)),
      );
    }
  }

  if (bootError) {
    return <p style={{ padding: "2rem", color: "#a33" }}>Bootstrap failed: {bootError}</p>;
  }

  if (!boot) {
    return null;
  }

  const brand = {
    tonePreset: boot.brand.tonePreset as "CLASSIC_LUXURY" | "MODERN_LUXURY" | "BOUTIQUE" | "FAMILY_FRIENDLY",
    primaryColor: boot.brand.primaryColor,
    displayFontStack: `var(--font-cormorant), serif`,
    bodyFontStack: `var(--font-work-sans), sans-serif`,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        padding: "2rem",
      }}
    >
      {open ? (
        <WidgetShell
          conciergeName={boot.hotel.conciergeName}
          hotelName={boot.hotel.name}
          brand={brand}
          logoUrl={boot.brand.logoUrl}
          avatarInitial={boot.hotel.name}
          onClose={() => setOpen(false)}
          ctaArea={
            ctaLink ? (
              <a
                href={ctaLink.url}
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: "var(--type-sm)",
                  color: "var(--brand-primary)",
                  textDecoration: "none",
                }}
              >
                {ctaLink.label} →
              </a>
            ) : undefined
          }
          inputBar={
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              style={{ display: "flex", gap: "var(--space-2)" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the concierge…"
                disabled={status !== "idle"}
                style={{
                  flex: 1,
                  border: "1px solid var(--neutral-300)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  fontSize: "var(--type-sm)",
                  background: "var(--neutral-0)",
                  color: "var(--neutral-900)",
                }}
              />
              <button
                type="submit"
                disabled={status !== "idle" || !input.trim()}
                style={{
                  border: "1px solid var(--brand-primary)",
                  background: "var(--brand-primary)",
                  color: "var(--neutral-0)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 16px",
                  fontSize: "var(--type-sm)",
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </form>
          }
        >
          {turns.length === 0 ? (
            <>
              <ConciergeMessage
                text={boot.greeting}
                showAvatar
                conciergeInitial={boot.hotel.name}
                logoUrl={boot.brand.logoUrl}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {boot.quickStart.map((qs) => (
                  <SuggestedChip
                    key={qs.contextTag}
                    label={qs.label}
                    onClick={() => send(qs.label, qs.contextTag)}
                    disabled={status !== "idle"}
                  />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {boot.suggestedQuestions.map((q) => (
                  <SuggestedChip key={q} label={q} onClick={() => send(q)} disabled={status !== "idle"} />
                ))}
              </div>
            </>
          ) : null}

          {turns.map((turn, i) => {
            if (turn.kind === "guest") return <GuestMessage key={i} text={turn.text} />;
            if (turn.kind === "concierge")
              return (
                <ConciergeMessage
                  key={i}
                  text={turn.text}
                  pending={turn.pending}
                  showAvatar
                  conciergeInitial={boot.hotel.name}
                  logoUrl={boot.brand.logoUrl}
                />
              );
            if (turn.kind === "cards") return <RecommendationCardRow key={i} cards={turn.cards} />;
            if (turn.kind === "leadPrompt") {
              if (turn.stage === "ask") {
                return (
                  <YesNoConfirm
                    key={i}
                    question={turn.question}
                    onYes={() => updateLeadTurn(turn.id, { stage: "value" })}
                    onNo={() => submitLead(turn.id, turn.promptId, turn.field, null, true)}
                  />
                );
              }
              if (turn.stage === "value" || turn.stage === "submitting") {
                return (
                  <LeadValueForm
                    key={i}
                    field={turn.field}
                    submitting={turn.stage === "submitting"}
                    onSubmit={(value) => submitLead(turn.id, turn.promptId, turn.field, value, false)}
                  />
                );
              }
              return (
                <p key={i} style={{ fontSize: "var(--type-sm)", color: "var(--neutral-600)", margin: 0 }}>
                  {turn.resultText}
                </p>
              );
            }
            if (turn.kind === "escalation")
              return (
                <EscalationPanel
                  key={i}
                  reason={turn.reason}
                  options={turn.options}
                  liveStaffAvailable={turn.liveStaffAvailable}
                  submitting={turn.submitting}
                  resultMessage={turn.resultMessage}
                  onSubmit={(choice, contact) => submitEscalation(turn.escalationId, choice, contact)}
                />
              );
            return null;
          })}

          {notice ? <p style={{ color: "#a33", fontSize: "var(--type-sm)", margin: 0 }}>{notice}</p> : null}
        </WidgetShell>
      ) : (
        <Launcher
          label={hasOpenedOnce ? "Ask the concierge" : boot.greeting.split(".")[0]}
          delayMs={hasOpenedOnce ? 0 : boot.launcherDelayMs}
          conciergeInitial={boot.hotel.name}
          logoUrl={boot.brand.logoUrl}
          brand={brand}
          onOpen={() => {
            setOpen(true);
            setHasOpenedOnce(true);
          }}
        />
      )}
    </main>
  );
}

function ctaLabel(kind: string): string {
  switch (kind) {
    case "book_now":
      return "Book now";
    case "explore_rooms":
      return "Explore rooms";
    case "plan_my_stay":
      return "Plan my stay";
    case "request_assistance":
      return "Request assistance";
    default:
      return "Continue";
  }
}

function LeadValueForm({
  field,
  submitting,
  onSubmit,
}: {
  field: LeadField;
  submitting: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const placeholder =
    field === "email" ? "you@example.com" : field === "phone" ? "Phone number" : field === "dates" ? "e.g. June 12–15" : "Full name";
  const inputType = field === "email" ? "email" : field === "phone" ? "tel" : "text";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      style={{ display: "flex", gap: "var(--space-2)" }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        type={inputType}
        disabled={submitting}
        style={{
          flex: 1,
          border: "1px solid var(--neutral-300)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 12px",
          fontSize: "var(--type-sm)",
          background: "var(--neutral-0)",
          color: "var(--neutral-900)",
        }}
      />
      <button
        type="submit"
        disabled={submitting || !value.trim()}
        style={{
          border: "1px solid var(--brand-primary)",
          background: "var(--brand-primary)",
          color: "var(--neutral-0)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 16px",
          fontSize: "var(--type-sm)",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </form>
  );
}
