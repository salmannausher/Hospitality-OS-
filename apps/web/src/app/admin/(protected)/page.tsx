"use client";

// Dashboard — Sprint 4 ticket 1 (API §3.6, UX §8 "Dashboard at a Glance").
// Visual design ported from the Stitch "Dashboard" mockup (Admin Dashboard
// redesign). Reads GET /v1/admin/analytics/daily for TODAY only, since UX §8's
// own mock is framed as "Chats Today" / a single-glance snapshot, not a range.
//
// `avgSatisfaction` shows "No data yet" rather than a fabricated number — no
// guest-facing satisfaction-capture flow exists anywhere in the product yet
// (docs/findings-log.md #12).
//
// The mockup's "Needs Attention" and "Trending Inquiries" panels are wired to
// real, already-shipped endpoints (listConversations/getTopicsAnalytics — the
// same calls the Conversations and Analytics pages use) rather than invented:
// - Needs Attention: the 3 most recent escalated conversations. `Conversation`
//   has no guest name/room number, so each row shows what's actually on the
//   record — domain tags, journey state, message count, relative start time —
//   not the mockup's fabricated "Room 402" specifics.
// - Trending Inquiries: the top 3 domains from the same topic distribution
//   the Analytics page's "Guests Ask Most About" list uses.
// The mockup's "Generate Report" button is dropped — no report-generation
// feature exists in the API spec.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  getDailyAnalytics,
  getTopicsAnalytics,
  listConversations,
  type ConversationSummary,
  type DailyMetricRow,
  type TopicDistributionRow,
} from "@hospitality/sdk";
import { ArrowRightIcon, BellIcon, BookIcon, ChartIcon } from "../icons";
import { domainLabel } from "../domain-labels";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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
  const [needsAttention, setNeedsAttention] = useState<ConversationSummary[] | null>(null);
  const [topics, setTopics] = useState<TopicDistributionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const today = todayIso();
    Promise.all([
      getDailyAnalytics(accessToken, { from: today, to: today, hotelId }),
      listConversations(accessToken, { escalated: true, hotelId, limit: 3 }),
      getTopicsAnalytics(accessToken, { hotelId }),
    ])
      .then(([daily, escalated, topicsResult]) => {
        if (cancelled) return;
        setRow(daily[0] ?? null);
        setNeedsAttention(escalated.items);
        setTopics(topicsResult);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId]);

  const topTopics = (topics ?? []).slice(0, 3);
  const maxTopicCount = Math.max(1, ...topTopics.map((t) => t.count));

  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <div>
        <p className="mb-1 text-xs font-semibold tracking-widest text-ink-soft uppercase">
          Morning Briefing
        </p>
        <h1 className="font-display text-3xl text-ink">Dashboard</h1>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {row === undefined ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {buildTiles(row).map((tile) => (
            <div
              key={tile.label}
              className="rounded-xl border border-line bg-white p-5 transition-colors hover:border-brass/50"
            >
              <p className="mb-2 text-sm text-ink-soft">{tile.label}</p>
              <p className="font-display text-3xl text-ink">{tile.value}</p>
            </div>
          ))}
        </section>
      )}

      {row === null && (
        <p className="text-sm text-mist">
          No activity recorded yet today — tiles will populate as guests chat with the concierge.
        </p>
      )}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <h2 className="border-b border-line pb-3 font-display text-xl text-ink">
            Needs Attention
          </h2>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {needsAttention === null ? (
              <p className="p-6 text-sm text-ink-soft">Loading…</p>
            ) : needsAttention.length === 0 ? (
              <p className="p-6 text-sm text-mist">No escalations right now.</p>
            ) : (
              needsAttention.map((conversation, i) => (
                <Link
                  key={conversation.id}
                  href="/admin/conversations"
                  className={`flex items-center justify-between gap-4 p-5 transition-colors hover:bg-parchment/40 ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                      <BellIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold tracking-wide text-red-600 uppercase">
                        Escalation
                        {conversation.journeyState ? ` · ${conversation.journeyState}` : ""}
                      </p>
                      <p className="text-sm font-medium text-ink">
                        {conversation.domainTags.length > 0
                          ? conversation.domainTags.map(domainLabel).join(", ")
                          : "General inquiry"}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {relativeTime(conversation.startedAt)} · {conversation.messageCount} message
                        {conversation.messageCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-mist" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <h2 className="border-b border-line pb-3 font-display text-xl text-ink">
            Trending Inquiries
          </h2>
          <div className="relative overflow-hidden rounded-xl border border-line bg-white p-5">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-brass" />
            <div className="mb-5 flex items-center gap-2 text-ink-soft">
              <ChartIcon className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-widest uppercase">AI Insights</span>
            </div>

            {topics === null ? (
              <p className="text-sm text-ink-soft">Loading…</p>
            ) : topTopics.length === 0 ? (
              <p className="text-sm text-mist">No conversations yet.</p>
            ) : (
              <div className="space-y-5">
                {topTopics.map((topic) => (
                  <div key={topic.domain}>
                    <div className="mb-1.5 flex items-end justify-between">
                      <span className="text-sm font-medium text-ink">
                        {domainLabel(topic.domain)}
                      </span>
                      <span className="text-xs text-ink-soft">
                        {topic.count} conversation{topic.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-parchment">
                      <div
                        className="h-full rounded-full bg-brass"
                        style={{ width: `${Math.max(6, (topic.count / maxTopicCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/admin/analytics"
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:bg-parchment"
            >
              <BookIcon className="h-4 w-4" />
              View All Analytics
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
