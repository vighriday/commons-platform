// Typed client for the COMMONS API. One place that knows the endpoint shapes.
import type {
  AgentRun,
  CivicPulse,
  FootprintDoc,
  Issue,
  IssueStatus,
  Report,
  Snapshot,
  StatusEvent,
  TwinDoc,
} from "@shared/types.ts";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  // Always send a JSON body (defaulting to {}). A body-less POST has no
  // Content-Length, which Google's front end rejects with 411 before the request
  // reaches the server. An empty object keeps body-less endpoints (corroborate)
  // working on Cloud Run.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

// The live SLA state attached to a single-issue response (computed server-side
// against the wall clock).
export interface SlaState {
  running: boolean;
  dueAt: string | null;
  daysElapsed: number;
  daysRemaining: number;
  overdue: boolean;
}
export type IssueDetail = Issue & { sla: SlaState };

export interface CorroborateResponse {
  issueId: string;
  corroborations: number;
  attentionScore: number;
  baselineAttention: number;
  crossedIntoCrowd: boolean;
  modelFlaggedEarly: boolean;
}
export interface StatusResponse {
  issueId: string;
  status: IssueStatus;
  timeline: StatusEvent[];
  sla: SlaState;
}

export const api = {
  issues: () => getJSON<{ ward: string; issues: Issue[] }>("/api/issues"),
  issue: (id: string) => getJSON<IssueDetail>(`/api/issues/${id}`),
  reports: () => getJSON<{ ward: string; reports: Report[] }>("/api/reports"),
  neighborhood: (ward: string) =>
    getJSON<{ twin: TwinDoc; civicPulse: CivicPulse }>(`/api/neighborhood/${ward}`),
  agentRun: () => getJSON<AgentRun>("/api/agent-run"),
  snapshots: (ward: string) =>
    getJSON<{ ward: string; snapshots: Snapshot[] }>(`/api/snapshots/${ward}`),
  footprints: (ward: string) => getJSON<FootprintDoc>(`/api/footprints/${ward}`),
  submit: submitReport,
  // Community verification — "I see this too".
  corroborate: (id: string) => postJSON<CorroborateResponse>(`/api/issues/${id}/corroborate`),
  // Lifecycle tracking — advance the status by one legal step.
  advanceStatus: (id: string, to: IssueStatus) =>
    postJSON<StatusResponse>(`/api/issues/${id}/status`, { to }),
  // The AI category classifier (used by the submit form for a live suggestion).
  classify: (text: string) =>
    postJSON<{ suggested: string; confidence: number; alternative: string | null; reason: string }>(
      "/api/classify",
      { text },
    ),
};

// A live citizen submission (multipart). Resolves with the born issue + the live
// trace, or throws a typed SubmitError carrying the server's reason (so the UI
// can show "quarantined", a validation message, etc.).
export interface LiveStep {
  agent: string;
  label: string;
  detail: string;
  live: boolean;
}
export interface AICategorization {
  suggested: string;
  confidence: number;
  alternative: string | null;
  reason: string;
}
export interface SubmitResult {
  issue: Issue;
  trace: LiveStep[];
  anyLive: boolean;
  piiNote: string | null;
  categorization: AICategorization | null;
}
export class SubmitError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

async function submitReport(form: {
  text: string;
  category: string;
  lat: number;
  lng: number;
  photo?: File | null;
}): Promise<SubmitResult> {
  const fd = new FormData();
  fd.append("text", form.text);
  fd.append("category", form.category);
  fd.append("lat", String(form.lat));
  fd.append("lng", String(form.lng));
  if (form.photo) fd.append("photo", form.photo);

  const res = await fetch("/api/submit", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new SubmitError(res.status, (body.error as string) ?? "SUBMIT_FAILED", body);
  }
  return body as unknown as SubmitResult;
}
