// The real embeddable widget (Sprint 5 ticket 4) — the same pipeline logic as
// apps/web/src/app/widget/page.tsx's harness (bootstrap → chat SSE → lead/
// escalation/cta handling), ported to run standalone on an arbitrary
// third-party host page rather than inside a Next.js app. Talks to the api
// ONLY through @hospitality/sdk (API-first, Engineering Conventions §1).
//
// Two things differ from the apps/web harness, both because there's no
// Next.js app around this code to lean on:
//   - Fonts: apps/web used next/font to load Bellevue's exact faces locally.
//     A script embedded on an arbitrary host site can't do that — this loads
//     BrandSettings.fontFamily via a plain Google Fonts <link>, falling back
//     to the tone preset's system-font stack when a hotel hasn't set one.
//   - Layout: the harness floated in a dev-page flex container. This owns its
//     real fixed corner position and the docs/08 §11 mobile full-screen
//     takeover, via WidgetShell's `fullscreen` prop.

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  type TonePreset,
} from "@hospitality/ui";

type Turn =
  | { kind: "guest"; text: string }
  | { kind: "concierge"; text: string; pending: boolean }
  | { kind: "cards"; cards: RecommendationCardEvent[] }
  | {
      kind: "leadPrompt";
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

const MOBILE_QUERY = "(max-width: 767px)";
const DESKTOP_PANEL_WIDTH = "min(24rem, calc(100vw - 32px))";

/** A host page has no module to import a React setter from — this is the one
 * integration point a plain `<script>`-embedded widget can offer for "open me
 * programmatically" (e.g. a "Ask the concierge" link elsewhere on the page):
 * `window.dispatchEvent(new Event("hospitality-widget:open"))`. */
export const OPEN_EVENT = "hospitality-widget:open";

/** Loads a hotel's display face from Google Fonts if BrandSettings set one —
 * the plain-CDN equivalent of what next/font does inside a Next.js app.
 * Idempotent: skips re-adding the same <link> across re-renders/re-mounts. */
function useGoogleFont(fontFamily: string | null | undefined) {
  useEffect(() => {
    if (!fontFamily) return;
    const id = `hospitality-widget-font-${fontFamily.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      fontFamily,
    )}:ital,wght@0,400;0,500;0,600;1,400&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function WidgetEmbed({ widgetKey }: { widgetKey: string }) {
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
  const isMobile = useIsMobile();

  useGoogleFont(boot?.brand.fontFamily);

  useEffect(() => {
    const onOpenRequest = () => {
      setOpen(true);
      setHasOpenedOnce(true);
    };
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_EVENT, onOpenRequest);
  }, []);

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    getBootstrap(widgetKey)
      .then(setBoot)
      .catch((e) => setBootError(String(e?.message ?? e)));
  }, [widgetKey]);

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
          widgetKey,
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

  function updateLeadTurn(promptId: string, patch: Partial<Extract<Turn, { kind: "leadPrompt" }>>) {
    setTurns((t) =>
      t.map((turn) => (turn.kind === "leadPrompt" && turn.promptId === promptId ? { ...turn, ...patch } : turn)),
    );
  }

  async function submitLead(promptId: string, field: LeadField, value: string | null, declined: boolean) {
    if (!conversationId.current) return;
    updateLeadTurn(promptId, { stage: "submitting" });
    try {
      await submitLeadAnswer(widgetKey, {
        conversationId: conversationId.current,
        promptId,
        field,
        value,
        consent: !declined,
        declined,
      });
      updateLeadTurn(promptId, {
        stage: "done",
        resultText: declined ? "No trouble at all." : "Got it — thank you.",
      });
    } catch (e) {
      setNotice(String((e as Error)?.message ?? e));
      updateLeadTurn(promptId, { stage: "value" });
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
      const res = await submitEscalationChoice(widgetKey, { escalationId, choice, contact });
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

  if (bootError || !boot) {
    // Fails silent on the host page rather than throwing a visible error at a
    // guest — a missing/revoked widget key is an integration problem for
    // whoever installed the script, not something a guest can act on.
    return null;
  }

  const brand = {
    tonePreset: boot.brand.tonePreset as TonePreset,
    primaryColor: boot.brand.primaryColor,
    displayFontStack: boot.brand.fontFamily ? `"${boot.brand.fontFamily}", serif` : null,
  };

  // Explicit px strings, not bare numbers — findings-log.md #30: bare numeric
  // values silently produced an empty `right`/`bottom` on this element (this
  // bundle's react-dom didn't unit-append them the way it normally would),
  // leaving the whole widget rendered in normal document flow instead of
  // pinned to the viewport corner.
  const wrapperStyle: CSSProperties = isMobile
    ? { position: "fixed", inset: open ? "0px" : "auto", right: open ? "0px" : "16px", bottom: open ? "0px" : "16px", zIndex: 2147483000 }
    : {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        width: DESKTOP_PANEL_WIDTH,
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 2147483000,
      };

  return (
    <div style={wrapperStyle}>
      {open ? (
        <WidgetShell
          conciergeName={boot.hotel.conciergeName}
          hotelName={boot.hotel.name}
          brand={brand}
          logoUrl={boot.brand.logoUrl}
          avatarInitial={boot.hotel.name}
          fullscreen={isMobile}
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
                  fontFamily: "inherit",
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
                  fontFamily: "inherit",
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
                    onYes={() => updateLeadTurn(turn.promptId, { stage: "value" })}
                    onNo={() => submitLead(turn.promptId, turn.field, null, true)}
                  />
                );
              }
              if (turn.stage === "value" || turn.stage === "submitting") {
                return (
                  <LeadValueForm
                    key={i}
                    field={turn.field}
                    submitting={turn.stage === "submitting"}
                    onSubmit={(value) => submitLead(turn.promptId, turn.field, value, false)}
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
    </div>
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
          fontFamily: "inherit",
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
          fontFamily: "inherit",
          fontSize: "var(--type-sm)",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </form>
  );
}
