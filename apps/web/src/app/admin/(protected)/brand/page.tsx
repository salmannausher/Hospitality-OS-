"use client";

// Admin Flow — Brand Settings (API §3.5, UI Design System §9/§10), Sprint 4
// ticket 4. Bare/unstyled, matching the rest of the protected shell (no
// design system yet, Sprint 5 decision pending). The live preview renders
// the same 5 fields the real guest widget's bootstrap() call actually reads
// (conciergeName, greeting, primaryColor, fontFamily, logoUrl — see
// apps/web/src/app/widget/page.tsx) using the form's UNSAVED state, so it's
// an honest "what guests will actually see" preview, not a mockup of a
// Sprint-5 design that doesn't exist yet.
//
// formalityNote/emojiAllowed/signOff/secondaryColor are editable here but
// not yet consumed by any guest-facing behavior (findings-log.md #18) — the
// form says so plainly rather than pretending they already do something.

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  BrandContrastError,
  getBrandSettings,
  updateBrandSettings,
  type BrandSettingsResponse,
  type ContrastFailureDetail,
  type UpdateBrandSettingsRequest,
} from "@hospitality/sdk";

const TONE_PRESETS: BrandSettingsResponse["tonePreset"][] = [
  "CLASSIC_LUXURY",
  "MODERN_LUXURY",
  "BOUTIQUE",
  "FAMILY_FRIENDLY",
];

function toFormState(brand: BrandSettingsResponse): UpdateBrandSettingsRequest {
  return {
    conciergeName: brand.conciergeName,
    tonePreset: brand.tonePreset,
    formalityNote: brand.formalityNote ?? "",
    emojiAllowed: brand.emojiAllowed,
    signOff: brand.signOff ?? "",
    greeting: brand.greeting,
    logoUrl: brand.logoUrl ?? "",
    primaryColor: brand.primaryColor ?? "",
    secondaryColor: brand.secondaryColor ?? "",
    fontFamily: brand.fontFamily ?? "",
    bookingEngineUrl: brand.bookingEngineUrl ?? "",
    groupInquiryThreshold: brand.groupInquiryThreshold,
  };
}

/** Empty-string form fields mean "unset" for nullable columns — convert back
 * to `null` before sending, so clearing a field actually clears it. */
function toRequestBody(form: UpdateBrandSettingsRequest): UpdateBrandSettingsRequest {
  const nullableIfEmpty = (v: string | undefined | null) =>
    v === "" ? null : v;
  return {
    ...form,
    formalityNote: nullableIfEmpty(form.formalityNote),
    signOff: nullableIfEmpty(form.signOff),
    logoUrl: nullableIfEmpty(form.logoUrl),
    primaryColor: nullableIfEmpty(form.primaryColor),
    secondaryColor: nullableIfEmpty(form.secondaryColor),
    fontFamily: nullableIfEmpty(form.fontFamily),
    bookingEngineUrl: nullableIfEmpty(form.bookingEngineUrl),
  };
}

function WidgetPreview({ form }: { form: UpdateBrandSettingsRequest }) {
  const accent = form.primaryColor || "#2F4A3C";
  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "1rem",
        maxWidth: 360,
        fontFamily: form.fontFamily || "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {form.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-provided arbitrary URL, live preview only
          <img src={form.logoUrl} alt="" style={{ height: 24, width: 24, objectFit: "contain" }} />
        )}
        <strong style={{ color: accent }}>{form.conciergeName || "Concierge"}</strong>
      </div>
      <p style={{ marginTop: 8 }}>{form.greeting || "Welcome! How may I help you today?"}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {["What time is breakfast?", "Do you allow pets?"].map((q) => (
          <span
            key={q}
            style={{
              fontSize: "0.8rem",
              padding: "4px 8px",
              border: `1px solid ${accent}`,
              borderRadius: 999,
              color: accent,
            }}
          >
            {q}
          </span>
        ))}
      </div>
    </section>
  );
}

export default function BrandSettingsPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [form, setForm] = useState<UpdateBrandSettingsRequest | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contrastFailures, setContrastFailures] = useState<ContrastFailureDetail[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getBrandSettings(accessToken, { hotelId })
      .then((brand) => {
        if (cancelled) return;
        setForm(toFormState(brand));
        setSavedAt(brand.updatedAt);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId]);

  function update<K extends keyof UpdateBrandSettingsRequest>(
    key: K,
    value: UpdateBrandSettingsRequest[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!accessToken || !form) return;
    setSaving(true);
    setError(null);
    setContrastFailures([]);
    try {
      const updated = await updateBrandSettings(accessToken, toRequestBody(form), { hotelId });
      setForm(toFormState(updated));
      setSavedAt(updated.updatedAt);
    } catch (err) {
      if (err instanceof BrandContrastError) {
        setContrastFailures(err.details);
        setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <div>
        <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Brand Settings</h1>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : <p>Loading…</p>}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Brand Settings</h1>
      <p style={{ color: "#999", fontSize: "0.85rem", marginBottom: "1rem" }}>
        {savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : "Not yet saved — showing defaults."}
      </p>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 280 }}>
          <label>
            Concierge name
            <input
              type="text"
              value={form.conciergeName ?? ""}
              onChange={(e) => update("conciergeName", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Greeting
            <input
              type="text"
              value={form.greeting ?? ""}
              onChange={(e) => update("greeting", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Tone preset
            <select
              value={form.tonePreset}
              onChange={(e) => update("tonePreset", e.target.value as UpdateBrandSettingsRequest["tonePreset"])}
              style={{ display: "block" }}
            >
              {TONE_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Logo URL
            <input
              type="text"
              value={form.logoUrl ?? ""}
              onChange={(e) => update("logoUrl", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Font family
            <input
              type="text"
              placeholder="system-ui, sans-serif"
              value={form.fontFamily ?? ""}
              onChange={(e) => update("fontFamily", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Primary color
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="color"
                value={form.primaryColor || "#2F4A3C"}
                onChange={(e) => update("primaryColor", e.target.value.toUpperCase())}
              />
              <input
                type="text"
                placeholder="#2F4A3C"
                value={form.primaryColor ?? ""}
                onChange={(e) => update("primaryColor", e.target.value)}
                style={{ width: 120 }}
              />
            </div>
          </label>
          <label>
            Secondary color{" "}
            <span style={{ color: "#999", fontSize: "0.75rem" }}>(not yet used anywhere guest-facing)</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="color"
                value={form.secondaryColor || "#2F4A3C"}
                onChange={(e) => update("secondaryColor", e.target.value.toUpperCase())}
              />
              <input
                type="text"
                placeholder="#2F4A3C"
                value={form.secondaryColor ?? ""}
                onChange={(e) => update("secondaryColor", e.target.value)}
                style={{ width: 120 }}
              />
            </div>
          </label>
          <label>
            Booking engine URL
            <input
              type="text"
              value={form.bookingEngineUrl ?? ""}
              onChange={(e) => update("bookingEngineUrl", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Group inquiry threshold
            <input
              type="number"
              min={1}
              value={form.groupInquiryThreshold ?? 15}
              onChange={(e) => update("groupInquiryThreshold", Number(e.target.value))}
              style={{ display: "block", width: 100 }}
            />
          </label>
          <label>
            Formality note <span style={{ color: "#999", fontSize: "0.75rem" }}>(not yet used anywhere guest-facing)</span>
            <input
              type="text"
              value={form.formalityNote ?? ""}
              onChange={(e) => update("formalityNote", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label>
            Sign-off <span style={{ color: "#999", fontSize: "0.75rem" }}>(not yet used anywhere guest-facing)</span>
            <input
              type="text"
              value={form.signOff ?? ""}
              onChange={(e) => update("signOff", e.target.value)}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={form.emojiAllowed ?? false}
              onChange={(e) => update("emojiAllowed", e.target.checked)}
            />
            Emoji allowed <span style={{ color: "#999", fontSize: "0.75rem" }}>(not yet used anywhere guest-facing)</span>
          </label>

          {contrastFailures.length > 0 && (
            <div style={{ color: "#9a6700", fontSize: "0.85rem" }}>
              <p style={{ fontWeight: 600 }}>Contrast check failed:</p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {contrastFailures.map((f) => (
                  <li key={f.field}>
                    {f.field} ({f.color}) vs. {f.against}: {f.ratio}:1, needs {f.required}:1
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && contrastFailures.length === 0 && <p style={{ color: "crimson" }}>{error}</p>}

          <button onClick={() => void handleSave()} disabled={saving} style={{ alignSelf: "flex-start" }}>
            Save
          </button>
        </div>

        <div>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Live preview</p>
          <WidgetPreview form={form} />
        </div>
      </div>
    </div>
  );
}
