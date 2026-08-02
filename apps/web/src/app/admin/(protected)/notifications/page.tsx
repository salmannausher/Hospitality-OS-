"use client";

// Admin Flow — Notifications (API §3.7), Sprint 4 ticket 7. Visual design
// ported from the Stitch "Notifications" mockup (Admin Dashboard redesign).
// Scoped to the calling admin's own notifications, not every teammate's
// (findings-log.md #21) — one row per `HotelMembership` per triggering
// event, no broadcast/role concept. Only real status transition is
// PENDING -> READ; SENT/FAILED imply an outbound delivery channel
// (email/push) this project doesn't build yet.
//
// The mockup's "Mark all as read" button isn't in the API spec (only
// per-notification PATCH exists) — dropped rather than faked as a single
// bulk action; each row keeps its own "Mark read" button instead.

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  listNotifications,
  markNotificationRead,
  type NotificationStatus,
  type NotificationSummary,
} from "@hospitality/sdk";
import { AlertIcon, BellIcon, BookIcon, LeadsIcon } from "../../icons";

const STATUS_FILTERS: { label: string; value: "any" | NotificationStatus }[] = [
  { label: "Any", value: "any" },
  { label: "Unread", value: "PENDING" },
  { label: "Read", value: "READ" },
];

const TYPE_LABELS: Record<string, string> = {
  NEW_LEAD: "New lead",
  ESCALATION: "Escalation",
  INGESTION_FAILED: "Ingestion failed",
  SYSTEM_ERROR: "System error",
  WEEKLY_REPORT: "Weekly report",
};

const TYPE_ICONS: Record<string, typeof BellIcon> = {
  NEW_LEAD: LeadsIcon,
  ESCALATION: AlertIcon,
  INGESTION_FAILED: BookIcon,
};

function summarize(notification: NotificationSummary): string {
  const p = notification.payload;
  switch (notification.type) {
    case "NEW_LEAD":
      return `${(p.name as string | null) || (p.email as string | null) || (p.phone as string | null) || "(no contact info)"} submitted a lead.`;
    case "ESCALATION":
      return `Conversation ${p.conversationId} was escalated: ${p.reason}`;
    case "INGESTION_FAILED":
      return `Document "${p.filename}" failed ingestion.`;
    default:
      return JSON.stringify(p);
  }
}

const selectClass =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";

export default function NotificationsPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  // MVP scope: the first hotel membership, same caveat as the other admin pages.
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [notifications, setNotifications] = useState<NotificationSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"any" | NotificationStatus>("any");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listNotifications(accessToken, {
      hotelId,
      status: statusFilter === "any" ? undefined : statusFilter,
    })
      .then(({ items, nextCursor: cursor }) => {
        if (cancelled) return;
        setNotifications(items);
        setNextCursor(cursor);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId, statusFilter]);

  async function loadMore() {
    if (!accessToken || !nextCursor) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor: cursor } = await listNotifications(accessToken, {
        hotelId,
        status: statusFilter === "any" ? undefined : statusFilter,
        cursor: nextCursor,
      });
      setNotifications((prev) => [...(prev ?? []), ...items]);
      setNextCursor(cursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(id: string) {
    if (!accessToken) return;
    try {
      const updated = await markNotificationRead(accessToken, id, { hotelId });
      setNotifications((prev) => prev?.map((n) => (n.id === id ? updated : n)) ?? prev);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Notifications</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Review system alerts, lead activities, and automated escalations requiring your attention.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        Status
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "any" | NotificationStatus)}
          className={selectClass}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {notifications === null ? (
          <p className="p-6 text-sm text-ink-soft">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="p-6 text-sm text-mist">No notifications.</p>
        ) : (
          notifications.map((n, i) => {
            const Icon = TYPE_ICONS[n.type] ?? BellIcon;
            const unread = n.status === "PENDING";
            return (
              <div
                key={n.id}
                className={`flex items-start justify-between gap-4 p-5 ${
                  i > 0 ? "border-t border-line" : ""
                } ${unread ? "bg-champagne/5" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      n.type === "ESCALATION"
                        ? "bg-red-50 text-red-600"
                        : "bg-champagne/25 text-brass"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p
                      className={`mb-1 text-xs tracking-wide uppercase ${
                        unread ? "font-semibold text-ink" : "font-medium text-ink-soft"
                      }`}
                    >
                      {TYPE_LABELS[n.type] ?? n.type}
                    </p>
                    <p className={`text-sm ${unread ? "font-medium text-ink" : "text-ink-soft"}`}>
                      {summarize(n)}
                    </p>
                    <p className="mt-1 text-xs text-mist">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      unread ? "bg-brass/15 text-brass" : "bg-parchment text-mist"
                    }`}
                  >
                    {n.status}
                  </span>
                  {unread && (
                    <button
                      onClick={() => void markRead(n.id)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brass hover:text-brass"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {nextCursor && (
        <button
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="self-start rounded-lg border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-parchment disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
