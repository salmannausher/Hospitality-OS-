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
  ConversationDetail,
  ConversationSummary,
  CreateKnowledgeDocumentResponse,
  CreateManualLeadRequest,
  DailyMetricRow,
  DocumentStatus,
  EntityByParam,
  EntityParam,
  EntitySearchResult,
  EntityType,
  FlagForPlaybookRequest,
  FlagForPlaybookResponse,
  JourneyState,
  KnowledgeChunkPreview,
  KnowledgeDocumentStageStatus,
  KnowledgeDocumentSummary,
  LeadStatus,
  LeadSummary,
  Paginated,
  QAScoreDetail,
  QAScoreInput,
  SubmitEscalationChoiceRequest,
  SubmitEscalationChoiceResponse,
  SubmitLeadAnswerRequest,
  SubmitLeadAnswerResponse,
  UpdateLeadRequest,
} from "@hospitality/types";

// Re-exported so frontend code has one import site for these shapes.
export type {
  AdminSessionResponse,
  BootstrapResponse,
  ConversationDetail,
  ConversationSummary,
  CreateKnowledgeDocumentResponse,
  CreateManualLeadRequest,
  DailyMetricRow,
  EntityByParam,
  EntityParam,
  EntitySearchResult,
  FlagForPlaybookRequest,
  FlagForPlaybookResponse,
  KnowledgeChunkPreview,
  KnowledgeDocumentStageStatus,
  KnowledgeDocumentSummary,
  LeadStatus,
  LeadSummary,
  Paginated,
  QAScoreDetail,
  QAScoreInput,
  SubmitEscalationChoiceRequest,
  SubmitEscalationChoiceResponse,
  SubmitLeadAnswerRequest,
  SubmitLeadAnswerResponse,
  UpdateLeadRequest,
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

// ---------------------------------------------------------------------------
// API §3.3 — Structured Entities. One uniform CRUD surface for all nine
// entity types plus the bundle-builder typeahead; `type` is the kebab-case
// route param (`room-types`, `spa-treatments`, ...) from `EntityByParam`.
// ---------------------------------------------------------------------------

export async function listEntities<T extends EntityParam>(
  accessToken: string,
  type: T,
  opts: { hotelId?: string; cursor?: string; limit?: number } = {},
): Promise<Paginated<EntityByParam[T]>> {
  const params = new URLSearchParams();
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(
    `${baseUrl()}/v1/admin/entities/${type}${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`entity list failed: ${res.status}`);
  }
  return (await res.json()) as Paginated<EntityByParam[T]>;
}

export async function getEntity<T extends EntityParam>(
  accessToken: string,
  type: T,
  id: string,
  opts: { hotelId?: string } = {},
): Promise<EntityByParam[T]> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(`${baseUrl()}/v1/admin/entities/${type}/${id}${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`entity fetch failed: ${res.status}`);
  }
  return (await res.json()) as EntityByParam[T];
}

export async function createEntity<T extends EntityParam>(
  accessToken: string,
  type: T,
  data: Record<string, unknown>,
  opts: { hotelId?: string } = {},
): Promise<EntityByParam[T]> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(`${baseUrl()}/v1/admin/entities/${type}${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`entity create failed: ${res.status}`);
  }
  return (await res.json()) as EntityByParam[T];
}

export async function updateEntity<T extends EntityParam>(
  accessToken: string,
  type: T,
  id: string,
  data: Record<string, unknown>,
  opts: { hotelId?: string } = {},
): Promise<EntityByParam[T]> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/entities/${type}/${id}${qs}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    throw new Error(`entity update failed: ${res.status}`);
  }
  return (await res.json()) as EntityByParam[T];
}

export async function deleteEntity(
  accessToken: string,
  type: EntityParam,
  id: string,
  opts: { hotelId?: string } = {},
): Promise<void> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/entities/${type}/${id}${qs}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`entity delete failed: ${res.status}`);
  }
}

/** Typeahead for the Relationship Bundle builder (UX §10). */
export async function searchEntities(
  accessToken: string,
  opts: { q: string; types?: EntityType[]; hotelId?: string },
): Promise<EntitySearchResult[]> {
  const params = new URLSearchParams();
  params.set("q", opts.q);
  if (opts.types?.length) params.set("types", opts.types.join(","));
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  const res = await fetch(
    `${baseUrl()}/v1/admin/entities/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`entity search failed: ${res.status}`);
  }
  return (await res.json()) as EntitySearchResult[];
}

/** Dashboard KPI tiles (UX §8) — `GET /v1/admin/analytics/daily?from=&to=`
 * (API §3.6). `from`/`to` are optional; the endpoint defaults to a 30-day
 * window ending today when omitted. */
export async function getDailyAnalytics(
  accessToken: string,
  opts: { from?: string; to?: string; hotelId?: string } = {},
): Promise<DailyMetricRow[]> {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  const qs = params.toString();
  const res = await fetch(
    `${baseUrl()}/v1/admin/analytics/daily${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`daily analytics fetch failed: ${res.status}`);
  }
  return (await res.json()) as DailyMetricRow[];
}

/** Triage list (UX §11) — `GET /v1/admin/conversations` (API §3.4). */
export async function listConversations(
  accessToken: string,
  opts: {
    escalated?: boolean;
    hasLead?: boolean;
    journeyState?: JourneyState;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
    hotelId?: string;
  } = {},
): Promise<Paginated<ConversationSummary>> {
  const params = new URLSearchParams();
  if (opts.escalated !== undefined) params.set("escalated", String(opts.escalated));
  if (opts.hasLead !== undefined) params.set("hasLead", String(opts.hasLead));
  if (opts.journeyState) params.set("journeyState", opts.journeyState);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  const qs = params.toString();
  const res = await fetch(
    `${baseUrl()}/v1/admin/conversations${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`conversation list failed: ${res.status}`);
  }
  return (await res.json()) as Paginated<ConversationSummary>;
}

/** Full thread — `GET /v1/admin/conversations/:id` (API §3.4). */
export async function getConversation(
  accessToken: string,
  id: string,
  opts: { hotelId?: string } = {},
): Promise<ConversationDetail> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/conversations/${id}${qs}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`conversation fetch failed: ${res.status}`);
  }
  return (await res.json()) as ConversationDetail;
}

/** ABS §15 rubric — `POST /v1/admin/conversations/:id/qa-score` (API §3.4).
 * 409 on an existing score — use `reviseQaScore` to revise. */
export async function submitQaScore(
  accessToken: string,
  conversationId: string,
  input: QAScoreInput,
  opts: { hotelId?: string } = {},
): Promise<QAScoreDetail> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/conversations/${conversationId}/qa-score${qs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    throw new Error(`qa-score submission failed: ${res.status}`);
  }
  return (await res.json()) as QAScoreDetail;
}

/** Revises an existing QA score — `PATCH /v1/admin/conversations/:id/qa-score`. */
export async function reviseQaScore(
  accessToken: string,
  conversationId: string,
  input: QAScoreInput,
  opts: { hotelId?: string } = {},
): Promise<QAScoreDetail> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/conversations/${conversationId}/qa-score${qs}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    throw new Error(`qa-score revision failed: ${res.status}`);
  }
  return (await res.json()) as QAScoreDetail;
}

/** Closes the Playbook §7 loop — `POST /v1/admin/conversations/:id/flag-for-playbook`. */
export async function flagForPlaybook(
  accessToken: string,
  conversationId: string,
  body: FlagForPlaybookRequest = {},
  opts: { hotelId?: string } = {},
): Promise<FlagForPlaybookResponse> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(
    `${baseUrl()}/v1/admin/conversations/${conversationId}/flag-for-playbook${qs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`flag-for-playbook failed: ${res.status}`);
  }
  return (await res.json()) as FlagForPlaybookResponse;
}

/** Inbox list — `GET /v1/admin/leads` (API §3.4). */
export async function listLeads(
  accessToken: string,
  opts: {
    status?: LeadStatus;
    cursor?: string;
    limit?: number;
    hotelId?: string;
  } = {},
): Promise<Paginated<LeadSummary>> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.hotelId) params.set("hotelId", opts.hotelId);
  const qs = params.toString();
  const res = await fetch(`${baseUrl()}/v1/admin/leads${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`lead list failed: ${res.status}`);
  }
  return (await res.json()) as Paginated<LeadSummary>;
}

/** `GET /v1/admin/leads/:id` (API §3.4). */
export async function getLead(
  accessToken: string,
  id: string,
  opts: { hotelId?: string } = {},
): Promise<LeadSummary> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(`${baseUrl()}/v1/admin/leads/${id}${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`lead fetch failed: ${res.status}`);
  }
  return (await res.json()) as LeadSummary;
}

/** Status/owner/notes updates — `PATCH /v1/admin/leads/:id` (API §3.4). */
export async function updateLead(
  accessToken: string,
  id: string,
  body: UpdateLeadRequest,
  opts: { hotelId?: string } = {},
): Promise<LeadSummary> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(`${baseUrl()}/v1/admin/leads/${id}${qs}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`lead update failed: ${res.status}`);
  }
  return (await res.json()) as LeadSummary;
}

/** Manual entry (a phone or walk-in inquiry) — `POST /v1/admin/leads` (API §3.4). */
export async function createManualLead(
  accessToken: string,
  body: CreateManualLeadRequest,
  opts: { hotelId?: string } = {},
): Promise<LeadSummary> {
  const qs = opts.hotelId ? `?hotelId=${encodeURIComponent(opts.hotelId)}` : "";
  const res = await fetch(`${baseUrl()}/v1/admin/leads${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`manual lead creation failed: ${res.status}`);
  }
  return (await res.json()) as LeadSummary;
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

// API §2.2 — POST /v1/chat/lead. Submits the guest's answer to a
// `lead_prompt`, one field at a time (UX §4). `Idempotency-Key` matches
// `promptId` per the spec — a resubmission (e.g. a double-tap) is safe to
// retry with the same header/body.
export async function submitLeadAnswer(
  widgetKey: string,
  request: SubmitLeadAnswerRequest,
): Promise<SubmitLeadAnswerResponse> {
  const res = await fetch(`${baseUrl()}/v1/chat/lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": widgetKey,
      "Idempotency-Key": request.promptId,
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`lead submission failed: ${res.status}`);
  }
  return (await res.json()) as SubmitLeadAnswerResponse;
}

// API §2.3 — POST /v1/chat/escalation/choose. Submits the guest's answer to
// an `escalation` event's handoff panel (UX §5).
export async function submitEscalationChoice(
  widgetKey: string,
  request: SubmitEscalationChoiceRequest,
): Promise<SubmitEscalationChoiceResponse> {
  const res = await fetch(`${baseUrl()}/v1/chat/escalation/choose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Widget-Key": widgetKey,
    },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`escalation choice submission failed: ${res.status}`);
  }
  return (await res.json()) as SubmitEscalationChoiceResponse;
}
