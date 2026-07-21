// @hospitality/sdk — the ONLY way apps/web talks to apps/api (Engineering Conventions
// §1, Principle 5 — API-first). Never a direct fetch() to a raw path from a component;
// call a typed function from here instead, so a route/shape change is a compiler error
// in the frontend, not a silent runtime mismatch.
//
// Signatures match docs/09-api-specification.md exactly.

import type {
  AdminSessionResponse,
  BootstrapResponse,
  ChatSSEEvent,
  CreateKnowledgeDocumentResponse,
  DocumentStatus,
  KnowledgeChunkPreview,
  KnowledgeDocumentStageStatus,
  KnowledgeDocumentSummary,
  Paginated,
} from "@hospitality/types";

// Re-exported so frontend code has one import site for these shapes.
export type {
  AdminSessionResponse,
  BootstrapResponse,
  CreateKnowledgeDocumentResponse,
  KnowledgeChunkPreview,
  KnowledgeDocumentStageStatus,
  KnowledgeDocumentSummary,
  Paginated,
} from "@hospitality/types";

/** Base URL of the api. Overridable for local dev / preview deploys. */
const DEFAULT_BASE_URL = "http://localhost:3000";

// Ambient-only — no @types/node dependency needed. Next.js's build-time env
// inlining requires the literal `process.env.NEXT_PUBLIC_X` member expression
// to appear verbatim in source (it's a static text/AST substitution, not a
// runtime lookup) — any indirection (destructuring `process.env` into a
// variable first, reading via `globalThis`) defeats it silently: the
// substitution never fires, and there is no real `process` global in the
// browser to fall back on, so it always resolves to undefined.
declare const process: { env: Record<string, string | undefined> };

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_BASE_URL;
}

// API §3.1 — GET /v1/admin/session. Called once after Supabase Auth hands the
// frontend a JWT, to know which hotel(s)/org(s) and roles it's working with.
export async function getAdminSession(
  accessToken: string,
): Promise<AdminSessionResponse> {
  const res = await fetch(`${baseUrl()}/v1/admin/session`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`admin session fetch failed: ${res.status}`);
  }
  return (await res.json()) as AdminSessionResponse;
}

// ---------------------------------------------------------------------------
// API §3.2 — Knowledge upload & validation (UX §9). `hotelId` is only needed
// when the caller belongs to more than one hotel (API §1: multi-hotel admins
// pass it as a query param, validated server-side against membership).
// ---------------------------------------------------------------------------

export async function uploadKnowledgeDocument(
  accessToken: string,
  params:
    | { hotelId?: string; file: File }
    | { hotelId?: string; sourceUrl: string },
): Promise<CreateKnowledgeDocumentResponse> {
  const qs = params.hotelId
    ? `?hotelId=${encodeURIComponent(params.hotelId)}`
    : "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  let body: BodyInit;
  if ("file" in params) {
    const form = new FormData();
    form.append("file", params.file);
    body = form; // fetch sets the multipart Content-Type (with boundary) itself.
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ sourceUrl: params.sourceUrl });
  }
  const res = await fetch(`${baseUrl()}/v1/admin/knowledge/documents${qs}`, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) {
    throw new Error(`knowledge document upload failed: ${res.status}`);
  }
  return (await res.json()) as CreateKnowledgeDocumentResponse;
}

export async function listKnowledgeDocuments(
  accessToken: string,
  opts: {
    hotelId?: string;
    status?: DocumentStatus;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<Paginated<KnowledgeDocumentSummary>> {
  const params = new URLSearchParams();
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  if (opts.status) params.set("status", opts.status);
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(
    `${baseUrl()}/v1/admin/knowledge/documents${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`knowledge document list failed: ${res.status}`);
  }
  return (await res.json()) as Paginated<KnowledgeDocumentSummary>;
}

export async function getKnowledgeDocumentStatus(
  accessToken: string,
  documentId: string,
  opts: { hotelId?: string } = {},
): Promise<KnowledgeDocumentStageStatus> {
  const qs = opts.hotelId
    ? `?hotelId=${encodeURIComponent(opts.hotelId)}`
    : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/knowledge/documents/${documentId}/status${qs}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`knowledge document status failed: ${res.status}`);
  }
  return (await res.json()) as KnowledgeDocumentStageStatus;
}

export async function getKnowledgeDocumentChunks(
  accessToken: string,
  documentId: string,
  opts: { hotelId?: string; cursor?: string; limit?: number } = {},
): Promise<Paginated<KnowledgeChunkPreview>> {
  const params = new URLSearchParams();
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(
    `${baseUrl()}/v1/admin/knowledge/documents/${documentId}/chunks${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`knowledge chunk preview failed: ${res.status}`);
  }
  return (await res.json()) as Paginated<KnowledgeChunkPreview>;
}

// API §2.4 — GET /v1/chat/bootstrap
export async function getBootstrap(
  widgetKey: string,
): Promise<BootstrapResponse> {
  const res = await fetch(`${baseUrl()}/v1/chat/bootstrap`, {
    headers: { "X-Widget-Key": widgetKey },
  });
  if (!res.ok) {
    throw new Error(`bootstrap failed: ${res.status}`);
  }
  return (await res.json()) as BootstrapResponse;
}

// API §2.1 — SSE stream. onEvent fires once per parsed ChatSSEEvent, in the
// ack → delta* → [card|lead_prompt|escalation|cta] → done|error order the
// protocol guarantees. (Sprint 1 emits ack/delta/done/error only.)
export async function sendChatMessage(
  params: {
    widgetKey: string;
    sessionId: string;
    conversationId: string | null;
    message: string;
    contextTag?: string | null;
  },
  onEvent: (event: ChatSSEEvent) => void,
): Promise<void> {
  const res = await fetch(`${baseUrl()}/v1/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": params.widgetKey,
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      conversationId: params.conversationId,
      message: params.message,
      contextTag: params.contextTag ?? null,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`chat message failed: ${res.status}`);
  }

  // Parse the text/event-stream: events are separated by a blank line, each
  // carrying a single `data: <json>` line whose JSON is a ChatSSEEvent.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("data:")) {
          const json = line.slice(5).trim();
          if (json) onEvent(JSON.parse(json) as ChatSSEEvent);
        }
      }
    }
  }
}
