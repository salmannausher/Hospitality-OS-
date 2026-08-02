"use client";

// Admin Flow — Analytics (UX §12 "Insights, Not Charts"), Sprint 4 ticket 6.
// Visual design ported from the Stitch "Analytics" mockup (Admin Dashboard
// redesign). Deliberately two ranked lists, not a chart library — matches the
// UX doc's own framing.
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
import { domainLabel } from "../../domain-labels";
import { AlertIcon, CheckIcon } from "../../icons";

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

  const maxTopicCount = Math.max(1, ...(topics ?? []).map((t) => t.count));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Analytics</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Insight into guest inquiries and knowledge base performance. Focus on filling
          information gaps to improve AI response confidence.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="mb-5 font-display text-xl text-ink">Guests Ask Most About</h2>
          {topics === null ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-mist">No conversations yet.</p>
          ) : (
            <div className="space-y-4">
              {topics.map((t) => (
                <div key={t.domain}>
                  <div className="mb-1.5 flex items-end justify-between">
                    <span className="text-sm font-medium text-ink">{domainLabel(t.domain)}</span>
                    <span className="text-xs text-ink-soft">
                      {t.count} conversation{t.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-parchment">
                    <div
                      className="h-full rounded-full bg-brass"
                      style={{ width: `${Math.max(6, (t.count / maxTopicCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-xl border border-line bg-white p-6">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500" />
          <h2 className="mb-5 flex items-center gap-2 font-display text-xl text-ink">
            <AlertIcon className="h-5 w-5 text-red-500" />
            Missing Information
          </h2>
          {gaps === null ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : gaps.length === 0 ? (
            <p className="text-sm text-mist">
              No repeated low-confidence topics this week — nothing urgent to add.
            </p>
          ) : (
            <>
              <ul className="mb-6 space-y-3">
                {gaps.map((g) => (
                  <li key={g.domain} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{domainLabel(g.domain)}</span>
                    <span className="text-right text-xs text-amber-700">
                      {g.lowConfidenceCount} low-confidence answer
                      {g.lowConfidenceCount === 1 ? "" : "s"} this week — no indexed content found
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <CheckIcon className="h-4 w-4 text-green-600" />
                Recommended Action
              </p>
              <ul className="space-y-2">
                {gaps.map((g) => (
                  <li key={g.domain} className="flex items-start gap-2 text-sm text-ink-soft">
                    <span className="text-brass">→</span>
                    {g.recommendedAction}
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
