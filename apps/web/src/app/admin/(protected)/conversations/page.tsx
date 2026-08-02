"use client";

// Admin Flow — Conversation Review (UX §11), Sprint 4 ticket 2. Visual design
// ported from the Stitch "Conversations" mockup (Admin Dashboard redesign) —
// same table+expandable-row convention as the Knowledge Base page: the list
// row is the triage view, expanding it reveals the full thread, the ABS §15
// QA rubric form, and the Playbook §7 "flag for playbook" action.
//
// The mockup showed 4 QA dimensions (Grounding/Tone/Escalation/Capture); the
// real rubric has 5 (ABS §15 also scores Resolution) — all 5 are kept, not
// trimmed to match the mockup.

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
import { domainLabel } from "../../domain-labels";

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

const selectClass =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";
const inputClass =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";

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
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-sm font-semibold text-ink">
        QA Rubric{" "}
        <span className="font-normal text-ink-soft">
          {detail.qaScore ? `(scored by ${detail.qaScore.scoredBy})` : "(not yet scored)"}
        </span>
      </p>
      <div className="mb-4 flex flex-wrap gap-4">
        {QA_DIMENSIONS.map((dim) => (
          <label key={dim.key} className="flex flex-col gap-1 text-xs text-ink-soft">
            <span className="font-semibold tracking-wide uppercase">{dim.label}</span>
            <select
              value={input[dim.key]}
              onChange={(e) =>
                setInput((prev) => ({ ...prev, [dim.key]: Number(e.target.value) }))
              }
              className={selectClass}
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
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <button
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-ivory transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
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
    <div className="mt-6 border-t border-line pt-5">
      <p className="mb-3 text-sm font-semibold text-ink">Flag for Playbook</p>
      <div className="mb-3 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Expected behavior (comma-separated)"
          value={expectedBehavior}
          onChange={(e) => setExpectedBehavior(e.target.value)}
          className={`${inputClass} w-72`}
        />
        <input
          type="text"
          placeholder="Must not (comma-separated)"
          value={mustNot}
          onChange={(e) => setMustNot(e.target.value)}
          className={`${inputClass} w-72`}
        />
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-parchment disabled:opacity-50"
        >
          Flag
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && <p className="text-xs text-green-700">Scenario created: {result}</p>}
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
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Conversations</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Review AI interactions, score responses, and flag behaviors to refine the concierge
          playbook.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Escalated
          <select
            value={escalatedFilter}
            onChange={(e) => setEscalatedFilter(e.target.value as EscalatedFilter)}
            className={selectClass}
          >
            <option value="any">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Has lead
          <select
            value={leadFilter}
            onChange={(e) => setLeadFilter(e.target.value as LeadFilter)}
            className={selectClass}
          >
            <option value="any">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {conversations === null ? (
          <p className="p-6 text-sm text-ink-soft">Loading…</p>
        ) : conversations.length === 0 ? (
          <p className="p-6 text-sm text-mist">
            No conversations yet — they&apos;ll appear here once guests start chatting.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-ink-soft uppercase">
                <th className="px-5 py-3 font-semibold">Started</th>
                <th className="px-3 py-3 font-semibold">Topics</th>
                <th className="px-3 py-3 font-semibold">Journey</th>
                <th className="px-3 py-3 font-semibold">Escalated</th>
                <th className="px-3 py-3 font-semibold">Lead score</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <Fragment key={conversation.id}>
                  <tr className="border-b border-line last:border-0 hover:bg-parchment/30">
                    <td className="px-5 py-3 whitespace-nowrap text-ink">
                      {new Date(conversation.startedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      {conversation.domainTags.length === 0 ? (
                        <span className="text-mist">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {conversation.domainTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-parchment px-2 py-0.5 text-xs text-ink-soft"
                            >
                              {domainLabel(tag)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{conversation.journeyState ?? "—"}</td>
                    <td className="px-3 py-3">
                      {conversation.escalated ? (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          Yes
                        </span>
                      ) : (
                        <span className="text-mist">No</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{conversation.leadScore ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => void toggleThread(conversation)}
                        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brass hover:text-brass"
                      >
                        {expandedId === conversation.id ? "Hide" : "View thread"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === conversation.id && (
                    <tr>
                      <td colSpan={6} className="border-b border-line bg-parchment/20 p-6">
                        {detail === null ? (
                          <p className="text-sm text-ink-soft">Loading thread…</p>
                        ) : (
                          <>
                            <ul className="flex flex-col gap-3">
                              {detail.messages.map((m) => (
                                <li
                                  key={m.id}
                                  className={`max-w-2xl rounded-xl border p-4 ${
                                    m.role === "GUEST"
                                      ? "border-line bg-white"
                                      : "border-brass/20 bg-champagne/10"
                                  }`}
                                >
                                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                                    {m.role}
                                    {m.journeyState ? ` · ${m.journeyState}` : ""}
                                    {m.confidenceBand ? ` · ${m.confidenceBand}` : ""}
                                    {m.escalationTriggered ? " · escalated" : ""}
                                    {m.leadCaptureTriggered ? " · lead_prompt" : ""}
                                  </p>
                                  <p className="text-sm text-ink">{m.content}</p>
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
    </div>
  );
}
