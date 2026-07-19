// @hospitality/sdk — the ONLY way apps/web talks to apps/api (Engineering Conventions
// §1, Principle 5 — API-first). Never a direct fetch() to a raw path from a component;
// call a typed function from here instead, so a route/shape change is a compiler error
// in the frontend, not a silent runtime mismatch.
//
// Stubbed now — implemented against real endpoints starting in Sprint 1
// (docs/14-sprint-backlog.md). Signatures match docs/09-api-specification.md exactly.

import type { ChatSSEEvent } from "@hospitality/types";

export interface BootstrapResponse {
  hotel: { name: string; conciergeName: string };
  brand: {
    tonePreset: string;
    primaryColor: string;
    fontFamily: string;
    logoUrl: string;
  };
  greeting: string;
  suggestedQuestions: string[];
  quickStart: Array<{ label: string; contextTag: string }>;
  launcherDelayMs: number;
}

// API §2.4
export async function getBootstrap(_widgetKey: string): Promise<BootstrapResponse> {
  throw new Error("Not implemented — Sprint 1 (docs/14-sprint-backlog.md)");
}

// API §2.1 — SSE stream. onEvent fires once per parsed ChatSSEEvent, in the
// ack → delta* → [card|lead_prompt|escalation|cta] → done|error order the
// protocol guarantees.
export async function sendChatMessage(
  _params: {
    widgetKey: string;
    sessionId: string;
    conversationId: string | null;
    message: string;
    contextTag?: string | null;
  },
  _onEvent: (event: ChatSSEEvent) => void,
): Promise<void> {
  throw new Error("Not implemented — Sprint 1 (docs/14-sprint-backlog.md)");
}
