"use client";

// Admin Flow — Notifications (API §3.7), Sprint 4 ticket 7. Bare/unstyled,
// matching the rest of the protected shell (no design system yet, Sprint 5
// decision pending). Scoped to the calling admin's own notifications, not
// every teammate's (findings-log.md #21) — one row per `HotelMembership`
// per triggering event, no broadcast/role concept. Only real status
// transition is PENDING -> READ; SENT/FAILED imply an outbound delivery
// channel (email/push) this project doesn't build yet.

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  listNotifications,
  markNotificationRead,
  type NotificationStatus,
  type NotificationSummary,
} from "@hospitality/sdk";

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
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Notifications</h1>

      <label style={{ fontSize: "0.85rem", marginBottom: "1rem", display: "inline-block" }}>
        Status{" "}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "any" | NotificationStatus)}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      {notifications === null ? (
        <p>Loading…</p>
      ) : notifications.length === 0 ? (
        <p style={{ color: "#999" }}>No notifications.</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Type</th>
                <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Summary</th>
                <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Received</th>
                <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr
                  key={n.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    fontWeight: n.status === "PENDING" ? 600 : 400,
                  }}
                >
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{TYPE_LABELS[n.type] ?? n.type}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{summarize(n)}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{n.status}</td>
                  <td>
                    {n.status === "PENDING" && (
                      <button onClick={() => void markRead(n.id)}>Mark read</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextCursor && (
            <button onClick={() => void loadMore()} disabled={loadingMore} style={{ marginTop: "1rem" }}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
