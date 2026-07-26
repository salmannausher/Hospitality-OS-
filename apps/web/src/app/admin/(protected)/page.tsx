"use client";

// Dashboard — Sprint 4 ticket 1 (API §3.6, UX §8 "Dashboard at a Glance").
// Bare/unstyled, matching the rest of the protected shell (no design system
// yet, Sprint 5 decision pending) — same conventions as the Knowledge Base
// page. Reads GET /v1/admin/analytics/daily for TODAY only, since UX §8's own
// mock is framed as "Chats Today" / a single-glance snapshot, not a range.
//
// `avgSatisfaction` shows "No data yet" rather than a fabricated number — no
// guest-facing satisfaction-capture flow exists anywhere in the product yet
// (docs/findings-log.md #12).

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { getDailyAnalytics, type DailyMetricRow } from "@hospitality/sdk";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Tile {
  label: string;
  value: string;
}

function buildTiles(row: DailyMetricRow | null): Tile[] {
  const conversations = row?.conversationCount ?? 0;
  const escalations = row?.escalationCount ?? 0;
  // Clamped to [0, 100] — escalationCount can exceed conversationCount (more
  // than one escalation inside the same conversation on the same day), which
  // would otherwise show a nonsensical negative percentage to an admin.
  const answeredWithoutHandoffPct =
    conversations > 0
      ? Math.max(0, Math.round(((conversations - escalations) / conversations) * 100))
      : null;

  return [
    { label: "Chats Today", value: String(conversations) },
    { label: "Qualified Leads", value: String(row?.leadCount ?? 0) },
    { label: "Escalations", value: String(escalations) },
    {
      label: "Answered w/o Handoff",
      value: answeredWithoutHandoffPct === null ? "—" : `${answeredWithoutHandoffPct}%`,
    },
    {
      label: "Guest Satisfaction",
      value: row?.avgSatisfaction != null ? row.avgSatisfaction.toFixed(1) : "No data yet",
    },
  ];
}

export default function AdminDashboardPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  // MVP scope: the first hotel membership, same caveat as the Knowledge Base
  // page — an Agency Admin spanning multiple hotels needs a picker, not built yet.
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [row, setRow] = useState<DailyMetricRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const today = todayIso();
    getDailyAnalytics(accessToken, { from: today, to: today, hotelId })
      .then((rows) => {
        if (cancelled) return;
        setRow(rows[0] ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId]);

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Dashboard</h1>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      {row === undefined ? (
        <p>Loading…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            maxWidth: 720,
          }}
        >
          {buildTiles(row).map((tile) => (
            <div
              key={tile.label}
              style={{
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "1rem",
              }}
            >
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {tile.label}
              </p>
              <p style={{ fontSize: "1.6rem", fontWeight: 600 }}>{tile.value}</p>
            </div>
          ))}
        </div>
      )}

      {row === null && (
        <p style={{ color: "#999", marginTop: "1.5rem", fontSize: "0.85rem" }}>
          No activity recorded yet today — tiles will populate as guests chat with the concierge.
        </p>
      )}
    </div>
  );
}
