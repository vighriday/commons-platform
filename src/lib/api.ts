// Typed client for the COMMONS API. One place that knows the endpoint shapes.
import type {
  AgentRun,
  CivicPulse,
  FootprintDoc,
  Issue,
  Report,
  Snapshot,
  TwinDoc,
} from "@shared/types.ts";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  issues: () => getJSON<{ ward: string; issues: Issue[] }>("/api/issues"),
  issue: (id: string) => getJSON<Issue>(`/api/issues/${id}`),
  reports: () => getJSON<{ ward: string; reports: Report[] }>("/api/reports"),
  neighborhood: (ward: string) =>
    getJSON<{ twin: TwinDoc; civicPulse: CivicPulse }>(`/api/neighborhood/${ward}`),
  agentRun: () => getJSON<AgentRun>("/api/agent-run"),
  snapshots: (ward: string) =>
    getJSON<{ ward: string; snapshots: Snapshot[] }>(`/api/snapshots/${ward}`),
  footprints: (ward: string) => getJSON<FootprintDoc>(`/api/footprints/${ward}`),
  submit: submitReport,
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
export interface SubmitResult {
  issue: Issue;
  trace: LiveStep[];
  anyLive: boolean;
  piiNote: string | null;
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
