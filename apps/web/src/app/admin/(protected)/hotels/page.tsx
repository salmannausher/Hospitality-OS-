"use client";

// Admin Flow — Hotel CRUD (API §3.1), Sprint 4 ticket 8. Bare/unstyled,
// matching the rest of the protected shell (no design system yet, Sprint 5
// decision pending). Unlike every other admin page, this one isn't scoped to
// "the caller's hotel" — it lists every hotel the caller can act on (direct
// HotelMembership rows PLUS org-reached hotels, findings-log.md #22) and
// lets an Agency Admin create a new one (findings-log.md #24 — the server
// rejects anyone else with 403 FORBIDDEN_ROLE, surfaced here as a plain
// error message rather than hidden client-side).

import { Fragment, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  createHotel,
  listHotels,
  updateHotel,
  type HotelSummary,
} from "@hospitality/sdk";

function EditHotelForm({
  hotel,
  onSaved,
}: {
  hotel: HotelSummary;
  onSaved: (updated: HotelSummary) => void;
}) {
  const { session } = useAdminAuth();
  const accessToken = session?.access_token ?? "";
  const [name, setName] = useState(hotel.name);
  const [slug, setSlug] = useState(hotel.slug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateHotel(accessToken, hotel.id, { name, slug });
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Edit hotel</p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
          Slug
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <button onClick={() => void handleSubmit()} disabled={saving}>
          Save
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: "0.85rem" }}>{error}</p>}
    </div>
  );
}

function CreateHotelForm({ onCreated }: { onCreated: () => void }) {
  const { session } = useAdminAuth();
  const accessToken = session?.access_token ?? "";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createHotel(accessToken, { name, slug });
      setName("");
      setSlug("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
        Onboard a new hotel (Agency Admin only)
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="slug-in-kebab-case"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button type="submit" disabled={saving}>
          Create hotel
        </button>
      </div>
      {error && <p style={{ color: "crimson", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </form>
  );
}

export default function HotelsPage() {
  const { session } = useAdminAuth();
  const accessToken = session?.access_token;

  const [hotels, setHotels] = useState<HotelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listHotels(accessToken)
      .then((items) => {
        if (cancelled) return;
        setHotels(items);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshKey]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function applyUpdate(updated: HotelSummary) {
    setHotels((prev) => prev?.map((h) => (h.id === updated.id ? updated : h)) ?? prev);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Hotels</h1>

      <CreateHotelForm onCreated={() => setRefreshKey((k) => k + 1)} />

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      {hotels === null ? (
        <p>Loading…</p>
      ) : hotels.length === 0 ? (
        <p style={{ color: "#999" }}>No hotels visible to this account.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Name</th>
              <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Slug</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <Fragment key={hotel.id}>
                <tr style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{hotel.name}</td>
                  <td style={{ padding: "0.5rem 1rem 0.5rem 0" }}>{hotel.slug}</td>
                  <td>
                    <button onClick={() => toggleExpand(hotel.id)}>
                      {expandedId === hotel.id ? "Hide" : "Edit"}
                    </button>
                  </td>
                </tr>
                {expandedId === hotel.id && (
                  <tr>
                    <td colSpan={3} style={{ background: "#fafafa", padding: "1rem" }}>
                      <EditHotelForm hotel={hotel} onSaved={applyUpdate} />
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
