"use client";

// Admin Flow — Knowledge Upload & Validation (UX §9), Sprint 2. Visual design
// ported from the Stitch "Knowledge Base" mockup (Admin Dashboard redesign).
//
// The mockup's "Knowledge Health" panel and storage-quota line have no real
// backing data (no storage-quota concept exists anywhere in the API spec) —
// storage is dropped entirely rather than fabricated, and "Index Coverage" is
// instead a real percentage computed from the already-loaded document list
// (indexed / total), not an invented number.
//
// The guided "Needs Review" edit form UX §9 also describes isn't built here —
// entity tables have no documentId link back to their source document, so
// there's nothing to target a pre-filled form at yet (see
// docs/14-sprint-backlog.md). validationIssues are shown read-only instead.
//
// Search/status-filter are real client-side filtering over the loaded page
// (same pattern as the Leads page) — no search endpoint exists to back a
// server-side version. Drag-and-drop onto the upload zone is real (same
// uploadKnowledgeDocument call the file-picker path uses), not decorative.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  getKnowledgeDocumentChunks,
  getKnowledgeDocumentStatus,
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentSummary,
} from "@hospitality/sdk";
import type { DocumentStatus } from "@hospitality/types";
import { BookIcon, PlugIcon, SearchIcon, SparkIcon } from "../../icons";
import { Pagination } from "../../pagination";

const PAGE_SIZE = 10;
// "Knowledge Health" needs to reflect the WHOLE knowledge base, not just the
// current paginated page — there's no total-count endpoint to derive it from
// otherwise, so this fetches a separate, larger snapshot just for the stats.
const HEALTH_SNAPSHOT_LIMIT = 200;

// UX §9: "progress labels: 'Reading…' → 'Chunking…' → 'Embedding…' → 'Ready' —
// plain-language status, not raw pipeline terminology."
const STAGE_LABELS: Record<string, string> = {
  PARSING: "Reading…",
  EXTRACTING: "Understanding content…",
  CHUNKING: "Chunking…",
  TAGGING: "Tagging…",
  EMBEDDING: "Embedding…",
  VALIDATING: "Checking…",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  INDEXED: { label: "Indexed", className: "bg-green-50 text-green-700" },
  NEEDS_REVIEW: { label: "Needs Review", className: "bg-amber-50 text-amber-700" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700" },
  PARSING: { label: "Processing…", className: "bg-parchment text-ink-soft" },
};

type StatusFilter = "any" | keyof typeof STATUS_BADGE;

const inputClass =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";
const selectClass =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";

export default function KnowledgeBasePage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  // MVP scope: the first hotel membership. An Agency Admin spanning multiple
  // hotels will need a picker here — not built yet, no multi-hotel admin
  // account exists to test against.
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[] | null>(null);
  const [healthDocs, setHealthDocs] = useState<KnowledgeDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [stageLabels, setStageLabels] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunkPreview[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  const refreshHealth = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { items } = await listKnowledgeDocuments(accessToken, {
        hotelId,
        limit: HEALTH_SNAPSHOT_LIMIT,
      });
      setHealthDocs(items);
    } catch {
      // Health panel is supplementary — the main list's error banner covers
      // the user-facing failure case; don't double-report here.
    }
  }, [accessToken, hotelId]);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { items, nextCursor: next } = await listKnowledgeDocuments(accessToken, {
        hotelId,
        status: statusFilter === "any" ? undefined : (statusFilter as DocumentStatus),
        cursor,
        limit: PAGE_SIZE,
      });
      setDocuments(items);
      setNextCursor(next);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
    void refreshHealth();
  }, [accessToken, hotelId, statusFilter, cursor, refreshHealth]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listKnowledgeDocuments(accessToken, {
      hotelId,
      status: statusFilter === "any" ? undefined : (statusFilter as DocumentStatus),
      cursor,
      limit: PAGE_SIZE,
    })
      .then(({ items, nextCursor: next }) => {
        if (cancelled) return;
        setDocuments(items);
        setNextCursor(next);
        setError(null);
        setPageLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setPageLoading(false);
      });
    listKnowledgeDocuments(accessToken, { hotelId, limit: HEALTH_SNAPSHOT_LIMIT })
      .then(({ items }) => {
        if (!cancelled) setHealthDocs(items);
      })
      .catch(() => {
        // Health panel is supplementary — the main list's error banner covers
        // the user-facing failure case; don't double-report here.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId, statusFilter, cursor]);

  function goNext() {
    if (!nextCursor) return;
    setPageLoading(true);
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(nextCursor);
  }

  function goPrev() {
    if (cursorStack.length === 0) return;
    setPageLoading(true);
    const prevCursor = cursorStack[cursorStack.length - 1];
    setCursorStack((prev) => prev.slice(0, -1));
    setCursor(prevCursor);
  }

  // While anything is actively processing, poll the list (to catch the final
  // status) and each in-flight document's per-stage status (for the
  // "Reading… Chunking… Embedding…" label) every 2s, per API §3.2.
  useEffect(() => {
    const inFlight = documents?.filter((d) => d.status === "PARSING") ?? [];
    if (inFlight.length === 0 || !accessToken) return;
    const interval = setInterval(() => {
      void refresh();
      for (const doc of inFlight) {
        void getKnowledgeDocumentStatus(accessToken, doc.id, { hotelId })
          .then(({ stages }) => {
            const current = stages.find((s) => s.status === "RUNNING") ?? stages[stages.length - 1];
            if (current) {
              setStageLabels((prev) => ({
                ...prev,
                [doc.id]: STAGE_LABELS[current.stage] ?? current.stage,
              }));
            }
          })
          .catch(() => {
            // Transient — the next tick retries.
          });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [documents, accessToken, hotelId, refresh]);

  async function upload(file: File) {
    if (!accessToken) return;
    setUploading(true);
    setError(null);
    try {
      await uploadKnowledgeDocument(accessToken, { file, hotelId });
      setCursor(undefined);
      setCursorStack([]);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await upload(file);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  async function handleUrlSubmit(e: FormEvent) {
    e.preventDefault();
    if (!urlInput || !accessToken) return;
    setUploading(true);
    setError(null);
    try {
      await uploadKnowledgeDocument(accessToken, { sourceUrl: urlInput, hotelId });
      setUrlInput("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleChunks(doc: KnowledgeDocumentSummary) {
    if (expandedId === doc.id) {
      setExpandedId(null);
      setChunks(null);
      return;
    }
    setExpandedId(doc.id);
    setChunks(null);
    if (!accessToken) return;
    try {
      const { items } = await getKnowledgeDocumentChunks(accessToken, doc.id, { hotelId });
      setChunks(items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Status is now a real server-side filter (paginating a client-only filter
  // over a single page would hide most matches) — only the free-text search
  // stays client-side, since no search endpoint exists to back it.
  const visibleDocuments = useMemo(() => {
    if (!documents) return documents;
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.filename.toLowerCase().includes(q) || (doc.sourceUrl ?? "").toLowerCase().includes(q),
    );
  }, [documents, search]);

  // Computed from the separate, larger healthDocs snapshot, not the current
  // page — "Knowledge Health" describes the whole knowledge base.
  const needsAttentionCount =
    healthDocs?.filter((d) => d.status === "NEEDS_REVIEW" || d.status === "FAILED").length ?? 0;
  const indexCoveragePct =
    healthDocs && healthDocs.length > 0
      ? Math.round((healthDocs.filter((d) => d.status === "INDEXED").length / healthDocs.length) * 100)
      : null;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Knowledge Base</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Manage the foundational intelligence of your concierge AI. Upload static documents or
          sync dynamic URLs to ensure your guests receive the most accurate, up-to-date
          information.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive ? "border-brass bg-champagne/10" : "border-line bg-white hover:border-brass/50"
          }`}
        >
          <BookIcon className="h-6 w-6 text-brass" />
          <p className="text-sm font-medium text-ink">Upload Document</p>
          <p className="text-xs text-ink-soft">
            Supported: PDF, TXT, MD, DOCX (Max 50MB)
            <br />
            Drag and drop your file here or click to browse
          </p>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>

        <form
          onSubmit={handleUrlSubmit}
          className="flex flex-col justify-center gap-3 rounded-xl border border-line bg-white p-8"
        >
          <div className="flex items-center gap-2">
            <PlugIcon className="h-5 w-5 text-brass" />
            <p className="text-sm font-medium text-ink">Sync from URL</p>
          </div>
          <p className="text-xs text-ink-soft">Automatically extract content from a public webpage.</p>
          <label className="mt-1 block text-left">
            <span className="mb-1 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Web Address
            </span>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://yourhotel.com/dining"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={uploading}
                className={`${inputClass} flex-1`}
              />
              <button
                type="submit"
                disabled={uploading || !urlInput}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                Sync
              </button>
            </div>
          </label>
        </form>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-ink">Document Library</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist" />
                <input
                  type="text"
                  placeholder="Search documents…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass} w-56 pl-9`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setCursor(undefined);
                  setCursorStack([]);
                }}
                className={selectClass}
              >
                <option value="any">All statuses</option>
                <option value="INDEXED">Indexed</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="FAILED">Failed</option>
                <option value="PARSING">Processing</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {visibleDocuments === null ? (
              <p className="p-6 text-sm text-ink-soft">Loading…</p>
            ) : visibleDocuments.length === 0 ? (
              <p className="p-6 text-sm text-mist">
                {documents && documents.length > 0
                  ? "No documents match your search."
                  : "No documents yet — upload one above."}
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    <th className="px-5 py-3 font-semibold">Document Name</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.map((doc) => {
                    const badge = STATUS_BADGE[doc.status] ?? {
                      label: doc.status,
                      className: "bg-parchment text-ink-soft",
                    };
                    return (
                      <Fragment key={doc.id}>
                        <tr className="border-b border-line last:border-0 hover:bg-parchment/30">
                          <td className="px-5 py-3 text-ink">
                            {doc.filename}
                            {doc.sourceUrl && (
                              <span className="ml-2 text-xs text-mist">{doc.sourceUrl}</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                            {doc.status === "PARSING" && stageLabels[doc.id] && (
                              <span className="ml-2 text-xs text-ink-soft">{stageLabels[doc.id]}</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => void toggleChunks(doc)}
                              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brass hover:text-brass"
                            >
                              {expandedId === doc.id ? "Hide" : "Preview"}
                            </button>
                          </td>
                        </tr>
                        {expandedId === doc.id && (
                          <tr>
                            <td colSpan={3} className="border-b border-line bg-parchment/20 p-5">
                              {doc.validationIssues.length > 0 && (
                                <div className="mb-4">
                                  <p className="mb-1 text-sm font-semibold text-ink">Needs review:</p>
                                  <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                                    {doc.validationIssues.map((issue, i) => (
                                      <li key={i}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {chunks === null ? (
                                <p className="text-sm text-ink-soft">Loading chunks…</p>
                              ) : chunks.length === 0 ? (
                                <p className="text-sm text-mist">No chunks yet.</p>
                              ) : (
                                <ul className="flex flex-col gap-3">
                                  {chunks.map((c) => (
                                    <li key={c.id} className="rounded-lg border border-line bg-white p-3">
                                      <span className="text-xs text-ink-soft">
                                        [{c.priority}] {c.domainTags.join(", ") || "untagged"}
                                      </span>
                                      <p className="mt-1 text-sm text-ink">{c.content}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
            {visibleDocuments !== null && visibleDocuments.length > 0 && (
              <Pagination
                count={visibleDocuments.length}
                hasPrev={cursorStack.length > 0}
                hasNext={!!nextCursor}
                loading={pageLoading}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className="rounded-xl border border-line bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <SparkIcon className="h-4 w-4 text-brass" />
              <h3 className="font-display text-lg text-ink">Knowledge Health</h3>
            </div>
            {indexCoveragePct === null ? (
              <p className="text-sm text-mist">Upload documents to see coverage.</p>
            ) : (
              <>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm text-ink-soft">Index Coverage</span>
                  <span className="font-display text-2xl text-ink">{indexCoveragePct}%</span>
                </div>
                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-parchment">
                  <div className="h-full rounded-full bg-brass" style={{ width: `${indexCoveragePct}%` }} />
                </div>
                <p className="text-sm text-ink-soft">
                  {needsAttentionCount === 0
                    ? "Your concierge AI has successfully indexed all of your provided materials."
                    : `Your concierge AI has successfully indexed most of your provided materials.`}
                </p>
                {needsAttentionCount > 0 && (
                  <p className="mt-2 text-sm font-medium text-amber-700">
                    Recommendation: review the {needsAttentionCount} item
                    {needsAttentionCount === 1 ? "" : "s"} needing attention to ensure responses
                    remain accurate.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
