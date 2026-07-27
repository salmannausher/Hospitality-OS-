"use client";

// Admin Flow — Leads Inbox (API §3.4), Sprint 4 ticket 3. Bare/unstyled,
// matching the rest of the protected shell (no design system yet, Sprint 5
// decision pending) — same table+expandable-row convention as Knowledge Base
// and Conversations. `source` ("chat"/"manual") is derived server-side from
// `conversationId` being null, not a stored column (findings-log.md #15).

import { Fragment, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  createManualLead,
  listLeads,
  updateLead,
  type LeadStatus,
  type LeadSummary,
} from "@hospitality/sdk";

const LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
];

type StatusFilter = "any" | LeadStatus;

function leadDisplayName(lead: LeadSummary): string {
  return lead.name || lead.email || lead.phone || "(no contact info)";
}

function EditLeadForm({
  lead,
  onSaved,
}: {
  lead: LeadSummary;
  onSaved: (updated: LeadSummary) => void;
}) {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token ?? "";
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [assignedOwnerId, setAssignedOwnerId] = useState(lead.assignedOwnerId ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateLead(
        accessToken,
        lead.id,
        {
          status,
          assignedOwnerId: assignedOwnerId.trim() === "" ? null : assignedOwnerId.trim(),
          notes: notes.trim() === "" ? null : notes,
        },
        { hotelId },
      );
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Update lead</p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.5rem" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          Assigned owner (user id)
          <input
            type="text"
            value={assignedOwnerId}
            onChange={(e) => setAssignedOwnerId(e.target.value)}
            style={{ width: 220 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", flex: 1, minWidth: 220 }}>
          Notes
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button onClick={() => void handleSubmit()} disabled={saving}>
          Save
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: "0.85rem" }}>{error}</p>}
    </div>
  );
}

function ManualLeadForm({ onCreated }: { onCreated: () => void }) {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token ?? "";
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [travelDates, setTravelDates] = useState("");
  const [reasonForStay, setReasonForStay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createManualLead(
        accessToken,
        {
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          travelDates: travelDates || undefined,
          reasonForStay: reasonForStay || undefined,
        },
        { hotelId },
      );
      setName("");
      setEmail("");
      setPhone("");
      setTravelDates("");
      setReasonForStay("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Log a manual lead (phone / walk-in)</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="text" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input
          type="text"
          placeholder="Travel dates"
          value={travelDates}
          onChange={(e) => setTravelDates(e.target.value)}
        />
        <input
          type="text"
          placeholder="Reason for stay"
          value={reasonForStay}
          onChange={(e) => setReasonForStay(e.target.value)}
        />
        <button type="submit" disabled={saving}>
          Log lead
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </form>
  );
}

export default function LeadsInboxPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  // MVP scope: the first hotel membership, same caveat as the other admin pages.
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [leads, setLeads] = useState<LeadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listLeads(accessToken, {
      hotelId,
      status: statusFilter === "any" ? undefined : statusFilter,
    })
      .then(({ items }) => {
        if (cancelled) return;
        setLeads(items);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId, statusFilter, refreshKey]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function applyUpdate(updated: LeadSummary) {
    setLeads((prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? prev);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Leads</h1>

      <ManualLeadForm onCreated={() => setRefreshKey((k) => k + 1)} />

      <label style={{ fontSize: "0.85rem", marginBottom: "1rem", display: "inline-block" }}>
        Status{" "}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="any">Any</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      {leads === null ? (
        <p>Loading…</p>
      ) : leads.length === 0 ? (
        <p style={{ color: "#999" }}>No leads yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Contact</th>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Source</th>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Status</th>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Owner</th>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <Fragment key={lead.id}>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{leadDisplayName(lead)}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{lead.source}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{lead.status}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{lead.assignedOwnerId ?? "—"}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => toggleExpand(lead.id)}>
                      {expandedId === lead.id ? "Hide" : "Edit"}
                    </button>
                  </td>
                </tr>
                {expandedId === lead.id && (
                  <tr>
                    <td colSpan={6} style={{ background: "#fafafa", padding: "1rem" }}>
                      <p style={{ fontSize: "0.85rem", color: "#666" }}>
                        {lead.email ? `Email: ${lead.email}` : ""}
                        {lead.phone ? ` · Phone: ${lead.phone}` : ""}
                        {lead.travelDates ? ` · Dates: ${lead.travelDates}` : ""}
                        {lead.reasonForStay ? ` · Reason: ${lead.reasonForStay}` : ""}
                      </p>
                      <EditLeadForm lead={lead} onSaved={applyUpdate} />
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
