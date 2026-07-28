"use client";

// Admin Flow — Analytics (UX §12 "Insights, Not Charts"), Sprint 4 ticket 6.
// Bare/unstyled, matching the rest of the protected shell (no design system
// yet, Sprint 5 decision pending). Deliberately two ranked lists, not a
// chart library — matches the UX doc's own framing.
//
// `domain` here is the real IA §2 taxonomy (8 fixed values: accommodation,
// booking, dining, spa, property, local_area, policies, events) — coarser
// than UX §12's own mockup examples ("Airport Transfer", "Pet Policy"),
// since nothing in the pipeline extracts anything finer (findings-log.md
// #20). The Missing Information panel defaults to a trailing 7-day window
// ("this week," matching the mockup) and only surfaces a domain once it's
// hit LOW confidence at least twice — a single occurrence reads as one
// ambiguous guest phrasing, not a real content gap.

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  getGapsAnalytics,
  getTopicsAnalytics,
  type MissingInformationGap,
  type TopicDistributionRow,
} from "@hospitality/sdk";

const DOMAIN_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  booking: "Booking",
  dining: "Dining",
  spa: "Spa",
  property: "Property",
  local_area: "Local Area",
  policies: "Policies",
  events: "Events",
};

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

export default function AnalyticsPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [topics, setTopics] = useState<TopicDistributionRow[] | null>(null);
  const [gaps, setGaps] = useState<MissingInformationGap[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    Promise.all([
      getTopicsAnalytics(accessToken, { hotelId }),
      getGapsAnalytics(accessToken, { hotelId }),
    ])
      .then(([topicsResult, gapsResult]) => {
        if (cancelled) return;
        setTopics(topicsResult);
        setGaps(gapsResult);
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
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Analytics</h1>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
        <section style={{ minWidth: 260 }}>
          <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Guests Ask Most About</p>
          {topics === null ? (
            <p>Loading…</p>
          ) : topics.length === 0 ? (
            <p style={{ color: "#999" }}>No conversations yet.</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {topics.map((t) => (
                <li key={t.domain} style={{ marginBottom: "0.4rem" }}>
                  {domainLabel(t.domain)}{" "}
                  <span style={{ color: "#999", fontSize: "0.85rem" }}>
                    ({t.count} conversation{t.count === 1 ? "" : "s"})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section style={{ minWidth: 320 }}>
          <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Missing Information</p>
          {gaps === null ? (
            <p>Loading…</p>
          ) : gaps.length === 0 ? (
            <p style={{ color: "#999" }}>
              No repeated low-confidence topics this week — nothing urgent to add.
            </p>
          ) : (
            <>
              <ul style={{ margin: "0 0 1.25rem", paddingLeft: "1.25rem" }}>
                {gaps.map((g) => (
                  <li key={g.domain} style={{ marginBottom: "0.5rem" }}>
                    <strong>{domainLabel(g.domain)}</strong>{" "}
                    <span style={{ color: "#9a6700" }}>
                      ({g.lowConfidenceCount} Low-Confidence answers this week — no indexed
                      content found)
                    </span>
                  </li>
                ))}
              </ul>
              <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Recommended Action</p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {gaps.map((g) => (
                  <li key={g.domain} style={{ marginBottom: "0.4rem" }}>
                    → {g.recommendedAction}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
