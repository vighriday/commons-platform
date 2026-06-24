// Typed client for the COMMONS API. One place that knows the endpoint shapes.
import type { AgentRun, CivicPulse, Issue, TwinDoc } from "@shared/types.ts";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  issues: () => getJSON<{ ward: string; issues: Issue[] }>("/api/issues"),
  issue: (id: string) => getJSON<Issue>(`/api/issues/${id}`),
  neighborhood: (ward: string) =>
    getJSON<{ twin: TwinDoc; civicPulse: CivicPulse }>(`/api/neighborhood/${ward}`),
  agentRun: () => getJSON<AgentRun>("/api/agent-run"),
};
