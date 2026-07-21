"use client";

// Admin Flow — Knowledge Upload & Validation (UX §9), Sprint 2. Bare/unstyled,
// matching the rest of the protected shell (no design system yet, Sprint 5
// decision pending) — this page proves upload → process → status → chunk
// preview works end to end, not final visual design.
//
// The guided "Needs Review" edit form UX §9 also describes isn't built here —
// entity tables have no documentId link back to their source document, so
// there's nothing to target a pre-filled form at yet (see
// docs/14-sprint-backlog.md). validationIssues are shown read-only instead.

import { Fragment, useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  getKnowledgeDocumentChunks,
  getKnowledgeDocumentStatus,
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentSummary,
} from "@hospitality/sdk";

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

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  INDEXED: { label: "Indexed", color: "#1a7f37" },
  NEEDS_REVIEW: { label: "Needs Review", color: "#9a6700" },
  FAILED: { label: "Failed", color: "#cf222e" },
  PARSING: { label: "Processing…", color: "#666" },
};

export default function KnowledgeBasePage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  // MVP scope: the first hotel membership. An Agency Admin spanning multiple
  // hotels will need a picker here — not built yet, no multi-hotel admin
  // account exists to test against.
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [stageLabels, setStageLabels] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunkPreview[] | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { items } = await listKnowledgeDocuments(accessToken, { hotelId });
      setDocuments(items);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [accessToken, hotelId]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listKnowledgeDocuments(accessToken, { hotelId })
      .then(({ items }) => {
        if (cancelled) return;
        setDocuments(items);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId]);

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

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accessToken) return;
    setUploading(true);
    setError(null);
    try {
      await uploadKnowledgeDocument(accessToken, { file, hotelId });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
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

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Knowledge Base</h1>

      <section style={{ display: "flex", gap: "2rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Upload a document</p>
          <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} disabled={uploading} />
        </div>
        <form onSubmit={handleUrlSubmit}>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Sync from a URL</p>
          <input
            type="url"
            placeholder="https://yourhotel.com/dining"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={uploading}
            style={{ width: 280, marginRight: "0.5rem" }}
          />
          <button type="submit" disabled={uploading || !urlInput}>
            Sync
          </button>
        </form>
      </section>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      {documents === null ? (
        <p>Loading…</p>
      ) : documents.length === 0 ? (
        <p style={{ color: "#999" }}>No documents yet — upload one above.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem 0" }}>Document</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const badge = STATUS_BADGE[doc.status] ?? { label: doc.status, color: "#666" };
              return (
                <Fragment key={doc.id}>
                  <tr style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "0.5rem 0" }}>
                      {doc.filename}
                      {doc.sourceUrl && (
                        <span style={{ color: "#999", fontSize: "0.8rem" }}> — {doc.sourceUrl}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: badge.color }}>● {badge.label}</span>
                      {doc.status === "PARSING" && stageLabels[doc.id] && (
                        <span style={{ color: "#999", marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                          {stageLabels[doc.id]}
                        </span>
                      )}
                    </td>
                    <td>
                      <button onClick={() => void toggleChunks(doc)}>
                        {expandedId === doc.id ? "Hide" : "Preview chunks"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === doc.id && (
                    <tr>
                      <td colSpan={3} style={{ background: "#fafafa", padding: "1rem" }}>
                        {doc.validationIssues.length > 0 && (
                          <div style={{ marginBottom: "1rem" }}>
                            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Needs review:</p>
                            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                              {doc.validationIssues.map((issue, i) => (
                                <li key={i} style={{ color: "#9a6700" }}>
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {chunks === null ? (
                          <p>Loading chunks…</p>
                        ) : chunks.length === 0 ? (
                          <p style={{ color: "#999" }}>No chunks yet.</p>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                            {chunks.map((c) => (
                              <li key={c.id} style={{ marginBottom: "0.5rem" }}>
                                <span style={{ fontSize: "0.75rem", color: "#999" }}>
                                  [{c.priority}] {c.domainTags.join(", ") || "untagged"}
                                </span>
                                <p style={{ margin: "0.25rem 0 0" }}>{c.content}</p>
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
    </div>
  );
}
