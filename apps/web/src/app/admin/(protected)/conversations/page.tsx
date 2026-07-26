"use client";

// Admin Flow — Conversation Review (UX §11), Sprint 4 ticket 2. Bare/unstyled,
// matching the rest of the protected shell (no design system yet, Sprint 5
// decision pending) — same table+expandable-row convention as the Knowledge
// Base page: the list row is the triage view, expanding it reveals the full
// thread, the ABS §15 QA rubric form, and the Playbook §7 "flag for
// playbook" action.

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  flagForPlaybook,
  getConversation,
  listConversations,
  reviseQaScore,
  submitQaScore,
  type ConversationDetail,
  type ConversationSummary,
  type QAScoreInput,
} from "@hospitality/sdk";

const QA_DIMENSIONS: Array<{ key: keyof QAScoreInput; label: string }> = [
  { key: "grounding", label: "Grounding" },
  { key: "tone", label: "Tone" },
  { key: "escalation", label: "Escalation" },
  { key: "leadCapture", label: "Lead Capture" },
  { key: "resolution", label: "Resolution" },
];

const DEFAULT_QA_INPUT: QAScoreInput = {
  grounding: 3,
  tone: 3,
  escalation: 3,
  leadCapture: 3,
  resolution: 3,
};

type EscalatedFilter = "any" | "true" | "false";
type LeadFilter = "any" | "true" | "false";

function QaRubricForm({
  detail,
  onSaved,
}: {
  detail: ConversationDetail;
  onSaved: () => void;
}) {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token ?? "";
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;
  const [input, setInput] = useState<QAScoreInput>(
    detail.qaScore
      ? {
          grounding: detail.qaScore.grounding,
          tone: detail.qaScore.tone,
          escalation: detail.qaScore.escalation,
          leadCapture: detail.qaScore.leadCapture,
          resolution: detail.qaScore.resolution,
        }
      : DEFAULT_QA_INPUT,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      if (detail.qaScore) {
        await reviseQaScore(accessToken, detail.id, input, { hotelId });
      } else {
        await submitQaScore(accessToken, detail.id, input, { hotelId });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
        QA Rubric {detail.qaScore ? `(scored by ${detail.qaScore.scoredBy})` : "(not yet scored)"}
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {QA_DIMENSIONS.map((dim) => (
          <label key={dim.key} style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
            {dim.label}
            <select
              value={input[dim.key]}
              onChange={(e) =>
                setInput((prev) => ({ ...prev, [dim.key]: Number(e.target.value) }))
              }
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {error && <p style={{ color: "crimson", fontSize: "0.85rem" }}>{error}</p>}
      <button onClick={() => void handleSubmit()} disabled={saving}>
        {detail.qaScore ? "Revise score" : "Submit score"}
      </button>
    </div>
  );
}

function FlagForPlaybookForm({ detail }: { detail: ConversationDetail }) {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token ?? "";
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [mustNot, setMustNot] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const { scenarioId } = await flagForPlaybook(
        accessToken,
        detail.id,
        {
          expectedBehavior: expectedBehavior
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          mustNot: mustNot
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        { hotelId },
      );
      setResult(scenarioId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Flag for Playbook</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <input
          type="text"
          placeholder="Expected behavior (comma-separated)"
          value={expectedBehavior}
          onChange={(e) => setExpectedBehavior(e.target.value)}
          style={{ width: 280 }}
        />
        <input
          type="text"
          placeholder="Must not (comma-separated)"
          value={mustNot}
          onChange={(e) => setMustNot(e.target.value)}
          style={{ width: 280 }}
        />
        <button onClick={() => void handleSubmit()} disabled={saving}>
          Flag
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: "0.85rem" }}>{error}</p>}
      {result && <p style={{ color: "#1a7f37", fontSize: "0.85rem" }}>Scenario created: {result}</p>}
    </div>
  );
}

export default function ConversationsPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  // MVP scope: the first hotel membership, same caveat as the Knowledge Base
  // and Dashboard pages — an Agency Admin spanning multiple hotels needs a
  // picker here, not built yet.
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escalatedFilter, setEscalatedFilter] = useState<EscalatedFilter>("any");
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("any");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listConversations(accessToken, {
      hotelId,
      escalated: escalatedFilter === "any" ? undefined : escalatedFilter === "true",
      hasLead: leadFilter === "any" ? undefined : leadFilter === "true",
    })
      .then(({ items }) => {
        if (cancelled) return;
        setConversations(items);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId, escalatedFilter, leadFilter]);

  const loadDetail = useCallback(
    async (conversationId: string) => {
      if (!accessToken) return;
      try {
        const data = await getConversation(accessToken, conversationId, { hotelId });
        setDetail(data);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [accessToken, hotelId],
  );

  function toggleThread(conversation: ConversationSummary) {
    if (expandedId === conversation.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(conversation.id);
    setDetail(null);
    void loadDetail(conversation.id);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Conversations</h1>

      <section style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.85rem" }}>
          Escalated{" "}
          <select value={escalatedFilter} onChange={(e) => setEscalatedFilter(e.target.value as EscalatedFilter)}>
            <option value="any">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label style={{ fontSize: "0.85rem" }}>
          Has lead{" "}
          <select value={leadFilter} onChange={(e) => setLeadFilter(e.target.value as LeadFilter)}>
            <option value="any">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </section>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      {conversations === null ? (
        <p>Loading…</p>
      ) : conversations.length === 0 ? (
        <p style={{ color: "#999" }}>No conversations yet — they&apos;ll appear here once guests start chatting.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem 0" }}>Started</th>
              <th>Topics</th>
              <th>Journey</th>
              <th>Escalated</th>
              <th>Lead score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <Fragment key={conversation.id}>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem 0" }}>
                    {new Date(conversation.startedAt).toLocaleString()}
                  </td>
                  <td>{conversation.domainTags.join(", ") || "—"}</td>
                  <td>{conversation.journeyState ?? "—"}</td>
                  <td style={{ color: conversation.escalated ? "#cf222e" : "#999" }}>
                    {conversation.escalated ? "Yes" : "No"}
                  </td>
                  <td>{conversation.leadScore ?? "—"}</td>
                  <td>
                    <button onClick={() => void toggleThread(conversation)}>
                      {expandedId === conversation.id ? "Hide" : "View thread"}
                    </button>
                  </td>
                </tr>
                {expandedId === conversation.id && (
                  <tr>
                    <td colSpan={6} style={{ background: "#fafafa", padding: "1rem" }}>
                      {detail === null ? (
                        <p>Loading thread…</p>
                      ) : (
                        <>
                          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                            {detail.messages.map((m) => (
                              <li key={m.id} style={{ marginBottom: "0.5rem" }}>
                                <span style={{ fontSize: "0.75rem", color: "#999" }}>
                                  {m.role}
                                  {m.journeyState ? ` · ${m.journeyState}` : ""}
                                  {m.confidenceBand ? ` · ${m.confidenceBand}` : ""}
                                  {m.escalationTriggered ? " · escalated" : ""}
                                  {m.leadCaptureTriggered ? " · lead_prompt" : ""}
                                </span>
                                <p style={{ margin: "0.25rem 0 0" }}>{m.content}</p>
                              </li>
                            ))}
                          </ul>
                          <QaRubricForm
                            detail={detail}
                            onSaved={() => void loadDetail(conversation.id)}
                          />
                          <FlagForPlaybookForm detail={detail} />
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
