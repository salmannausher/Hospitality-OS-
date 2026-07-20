"use client";

// Minimal, deliberately unstyled widget harness (docs/14 Sprint 1). It proves
// the guest-facing path end to end — bootstrap, the ack cue, and streamed plain
// text — against the real api. No design system yet; that arrives in Sprint 5.
// Talks to the api ONLY through @hospitality/sdk (API-first, Eng Conventions §1).

import { useEffect, useRef, useState } from "react";
import {
  getBootstrap,
  sendChatMessage,
  type BootstrapResponse,
} from "@hospitality/sdk";

const WIDGET_KEY = "wk_demo_bellevue"; // the seeded Bellevue demo key

interface Turn {
  role: "guest" | "concierge";
  text: string;
}

export default function WidgetHarness() {
  const [boot, setBoot] = useState<BootstrapResponse | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "acking" | "streaming">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const sessionId = useRef<string>("");
  const conversationId = useRef<string | null>(null);

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    getBootstrap(WIDGET_KEY)
      .then(setBoot)
      .catch((e) => setBootError(String(e?.message ?? e)));
  }, []);

  async function send(message: string) {
    if (!message.trim() || status !== "idle") return;
    setInput("");
    setNotice(null);
    setTurns((t) => [...t, { role: "guest", text: message }]);
    setStatus("acking");

    // Placeholder concierge turn we fill as deltas arrive.
    let conciergeIndex = -1;
    setTurns((t) => {
      conciergeIndex = t.length;
      return [...t, { role: "concierge", text: "" }];
    });

    try {
      await sendChatMessage(
        {
          widgetKey: WIDGET_KEY,
          sessionId: sessionId.current,
          conversationId: conversationId.current,
          message,
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
                next[conciergeIndex] = {
                  role: "concierge",
                  text: next[conciergeIndex].text + event.text,
                };
                return next;
              });
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

  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.1rem" }}>Widget harness (Sprint 1)</h1>
      <p style={{ color: "#666", fontSize: "0.85rem" }}>
        Bare, unstyled. Renders the ack cue and streamed text from the real api.
      </p>

      {bootError && <p style={{ color: "crimson" }}>Bootstrap failed: {bootError}</p>}

      {boot && (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginTop: "1rem" }}>
          <strong>{boot.hotel.conciergeName}</strong>
          <p style={{ marginTop: 4 }}>{boot.greeting}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {boot.suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={status !== "idle"}
                style={{ fontSize: "0.8rem", padding: "4px 8px", border: "1px solid #ccc", borderRadius: 999, background: "#fafafa", cursor: "pointer" }}
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
        {turns.map((t, i) => (
          <li key={i} style={{ margin: "0.75rem 0" }}>
            <span style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#999" }}>{t.role}</span>
            <div>{t.text || (t.role === "concierge" && status === "streaming" ? "…" : "")}</div>
          </li>
        ))}
      </ul>

      {status === "acking" && <p style={{ color: "#999", fontSize: "0.8rem" }}>Concierge is acknowledging…</p>}
      {notice && <p style={{ color: "crimson", fontSize: "0.85rem" }}>{notice}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{ display: "flex", gap: 8, marginTop: "1rem" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the concierge…"
          disabled={!boot || status !== "idle"}
          style={{ flex: 1, padding: "8px", border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button type="submit" disabled={!boot || status !== "idle"} style={{ padding: "8px 16px", borderRadius: 6 }}>
          Send
        </button>
      </form>
    </main>
  );
}
