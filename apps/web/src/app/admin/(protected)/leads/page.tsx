"use client";

// Admin Flow — Leads Inbox (API §3.4), Sprint 4 ticket 3. Visual design
// ported from the Stitch "Leads" mockup (Admin Dashboard redesign) — same
// table+expandable-row convention as Knowledge Base and Conversations.
// `source` ("chat"/"manual") is derived server-side from `conversationId`
// being null, not a stored column (findings-log.md #15).
//
// The mockup's "Search leads…" box is real, client-side filtering over the
// already-loaded page (name/email/phone) — not wired to a search endpoint,
// since none exists in the API spec.

import { Fragment, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  createManualLead,
  listLeads,
  updateLead,
  type LeadStatus,
  type LeadSummary,
} from "@hospitality/sdk";
import { PlusIcon, SearchIcon } from "../../icons";

const LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: "bg-champagne/25 text-brass",
  CONTACTED: "bg-sky-50 text-sky-700",
  QUALIFIED: "bg-green-50 text-green-700",
  CONVERTED: "bg-ink text-ivory",
  LOST: "bg-parchment text-mist",
};

type StatusFilter = "any" | LeadStatus;

const selectClass =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";
const inputClass =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";

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
    <div className="mt-4 border-t border-line pt-4">
      <p className="mb-3 text-sm font-semibold text-ink">Update lead</p>
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          <span className="font-semibold tracking-wide uppercase">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
            className={selectClass}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-soft">
          <span className="font-semibold tracking-wide uppercase">Assigned owner (user id)</span>
          <input
            type="text"
            value={assignedOwnerId}
            onChange={(e) => setAssignedOwnerId(e.target.value)}
            className={`${inputClass} w-56`}
          />
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-ink-soft">
          <span className="font-semibold tracking-wide uppercase">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-ivory transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
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
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-line bg-white p-6"
    >
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <PlusIcon className="h-4 w-4 text-brass" />
        Log a manual lead (phone / walk-in)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          placeholder="Guest name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Expected dates"
          value={travelDates}
          onChange={(e) => setTravelDates(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="e.g. Anniversary"
          value={reasonForStay}
          onChange={(e) => setReasonForStay(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-ivory transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        <PlusIcon className="h-4 w-4" />
        {saving ? "Logging…" : "Log Lead"}
      </button>
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
  const [search, setSearch] = useState("");
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

  const visibleLeads = useMemo(() => {
    if (!leads) return leads;
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.email, lead.phone].some((field) => field?.toLowerCase().includes(q)),
    );
  }, [leads, search]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function applyUpdate(updated: LeadSummary) {
    setLeads((prev) => prev?.map((l) => (l.id === updated.id ? updated : l)) ?? prev);
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Leads</h1>
        <p className="mt-2 text-sm text-ink-soft">Manage and track prospective guest inquiries.</p>
      </div>

      <ManualLeadForm onCreated={() => setRefreshKey((k) => k + 1)} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={selectClass}
          >
            <option value="any">Any</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist" />
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} w-64 pl-9`}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {visibleLeads === null ? (
          <p className="p-6 text-sm text-ink-soft">Loading…</p>
        ) : visibleLeads.length === 0 ? (
          <p className="p-6 text-sm text-mist">
            {leads && leads.length > 0 ? "No leads match your search." : "No leads yet."}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-ink-soft uppercase">
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 font-semibold">Source</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Owner</th>
                <th className="px-3 py-3 font-semibold">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead) => (
                <Fragment key={lead.id}>
                  <tr className="border-b border-line last:border-0 hover:bg-parchment/30">
                    <td className="px-5 py-3 text-ink">{leadDisplayName(lead)}</td>
                    <td className="px-3 py-3 text-ink-soft capitalize">{lead.source}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[lead.status]}`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{lead.assignedOwnerId ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-soft">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => toggleExpand(lead.id)}
                        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brass hover:text-brass"
                      >
                        {expandedId === lead.id ? "Hide" : "Edit"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === lead.id && (
                    <tr>
                      <td colSpan={6} className="border-b border-line bg-parchment/20 p-6">
                        <p className="text-sm text-ink-soft">
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
    </div>
  );
}
