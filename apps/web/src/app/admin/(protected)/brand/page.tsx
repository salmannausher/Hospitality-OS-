"use client";

// Admin Flow — Brand Settings (API §3.5, UI Design System §9/§10), Sprint 4
// ticket 4. Visual design ported from the Stitch "Brand Settings" mockup
// (Admin Dashboard redesign). The live preview renders the same 5 fields the
// real guest widget's bootstrap() call actually reads (conciergeName,
// greeting, primaryColor, fontFamily, logoUrl — see
// apps/web/src/app/widget/page.tsx) using the form's UNSAVED state, so it's
// an honest "what guests will actually see" preview, not a mockup of a
// Sprint-5 design that doesn't exist yet — the fixed ivory/ink/brass shell
// tokens below style the surrounding admin chrome only; the preview card
// itself uses the hotel's own configured font/color, exactly as it will
// render for a real guest.
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
import { ConciergeMessage, SuggestedChip, WidgetShell } from "@hospitality/ui";
import "@hospitality/ui/tokens.css";

const TONE_PRESETS: BrandSettingsResponse["tonePreset"][] = [
  "CLASSIC_LUXURY",
  "MODERN_LUXURY",
  "BOUTIQUE",
  "FAMILY_FRIENDLY",
];

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold tracking-wide text-ink-soft uppercase";
const notYetUsedClass = "ml-2 rounded-full bg-parchment px-2 py-0.5 text-[10px] text-mist normal-case";

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
  const nullableIfEmpty = (v: string | undefined | null) => (v === "" ? null : v);
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

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label>
      <span className={labelClass}>
        {label}
        {hint && <span className={notYetUsedClass}>{hint}</span>}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#2F4A3C"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-white p-1"
        />
        <input
          type="text"
          placeholder="#2F4A3C"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} font-mono`}
        />
      </div>
    </label>
  );
}

/**
 * findings-log.md #51 — this used to hand-roll its own preview markup,
 * which drifted from packages/ui's actual "accent, not background" rule
 * (UI Design System §3) into a full-bleed colored header the real widget
 * never renders. Composing the real WidgetShell/ConciergeMessage/
 * SuggestedChip components here means this preview can't drift from the
 * real widget again — any future style change to those components shows up
 * here automatically.
 */
function WidgetPreview({ form }: { form: UpdateBrandSettingsRequest }) {
  return (
    <WidgetShell
      conciergeName={form.conciergeName || "Concierge"}
      hotelName=""
      brand={{
        tonePreset: form.tonePreset ?? "MODERN_LUXURY",
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        displayFontStack: form.fontFamily,
      }}
      logoUrl={form.logoUrl}
      inputBar={
        <div
          style={{
            border: "1px solid var(--neutral-300)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--type-sm)",
            color: "var(--neutral-600)",
          }}
        >
          Ask the concierge…
        </div>
      }
    >
      <ConciergeMessage
        text={form.greeting || "Welcome! How may I help you today?"}
        showAvatar={false}
        conciergeInitial={(form.conciergeName || "C").slice(0, 1)}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {["What time is breakfast?", "Do you allow pets?"].map((q) => (
          <SuggestedChip key={q} label={q} onClick={() => {}} disabled />
        ))}
      </div>
    </WidgetShell>
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
      <div className="max-w-md">
        <h1 className="font-display text-3xl text-ink">Brand Settings</h1>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Loading…</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl text-ink">Brand Settings</h1>
        <p className="text-xs text-mist">
          {savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}` : "Not yet saved — showing defaults."}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-ink-soft uppercase">
              Identity
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Concierge Name</span>
                <input
                  type="text"
                  value={form.conciergeName ?? ""}
                  onChange={(e) => update("conciergeName", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Tone Preset</span>
                <select
                  value={form.tonePreset}
                  onChange={(e) =>
                    update("tonePreset", e.target.value as UpdateBrandSettingsRequest["tonePreset"])
                  }
                  className={inputClass}
                >
                  {TONE_PRESETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>Greeting</span>
              <input
                type="text"
                value={form.greeting ?? ""}
                onChange={(e) => update("greeting", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="mt-4 block">
              <span className={labelClass}>Logo URL</span>
              <input
                type="text"
                value={form.logoUrl ?? ""}
                onChange={(e) => update("logoUrl", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-ink-soft uppercase">
              Typography &amp; Color
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Font Family</span>
                <input
                  type="text"
                  placeholder="system-ui, sans-serif"
                  value={form.fontFamily ?? ""}
                  onChange={(e) => update("fontFamily", e.target.value)}
                  className={inputClass}
                />
              </label>
              <ColorField
                label="Primary Color"
                value={form.primaryColor}
                onChange={(v) => update("primaryColor", v)}
              />
              <ColorField
                label="Secondary Color"
                value={form.secondaryColor}
                onChange={(v) => update("secondaryColor", v)}
                hint="not yet used"
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white p-6">
            <h2 className="mb-4 text-xs font-semibold tracking-widest text-ink-soft uppercase">
              System &amp; Logic
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className={labelClass}>Booking Engine URL</span>
                <input
                  type="text"
                  value={form.bookingEngineUrl ?? ""}
                  onChange={(e) => update("bookingEngineUrl", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label>
                <span className={labelClass}>Group Inquiry Threshold</span>
                <input
                  type="number"
                  min={1}
                  value={form.groupInquiryThreshold ?? 15}
                  onChange={(e) => update("groupInquiryThreshold", Number(e.target.value))}
                  className={`${inputClass} w-28`}
                />
              </label>
              <label className="flex items-center gap-3 self-end pb-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.emojiAllowed ?? false}
                  onClick={() => update("emojiAllowed", !(form.emojiAllowed ?? false))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    form.emojiAllowed ? "bg-brass" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.emojiAllowed ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm text-ink-soft">
                  Emojis Allowed<span className={notYetUsedClass}>not yet used</span>
                </span>
              </label>
            </div>

            <label className="mt-4 block">
              <span className={labelClass}>
                Formality Note<span className={notYetUsedClass}>not yet used</span>
              </span>
              <input
                type="text"
                value={form.formalityNote ?? ""}
                onChange={(e) => update("formalityNote", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="mt-4 block">
              <span className={labelClass}>
                Sign-off<span className={notYetUsedClass}>not yet used</span>
              </span>
              <input
                type="text"
                value={form.signOff ?? ""}
                onChange={(e) => update("signOff", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          {contrastFailures.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="mb-1 font-semibold">Contrast check failed:</p>
              <ul className="list-disc pl-5">
                {contrastFailures.map((f) => (
                  <li key={f.field}>
                    {f.field} ({f.color}) vs. {f.against}: {f.ratio}:1, needs {f.required}:1
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && contrastFailures.length === 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="self-start rounded-lg bg-ink px-6 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-widest text-ink-soft uppercase">
              Live Preview
            </span>
            <span className="text-xs font-semibold tracking-widest text-brass uppercase">
              Guest View
            </span>
          </div>
          <div className="flex justify-center rounded-xl border border-line bg-parchment/20 p-6">
            <WidgetPreview form={form} />
          </div>
        </div>
      </section>
    </div>
  );
}
