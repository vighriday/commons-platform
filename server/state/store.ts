// COMMONS — runtime state store (the live overlay).
//
// The seed JSON is frozen and immutable; it is the demo-safe read path. But three
// of the platform's verbs — VALIDATE (crowd corroboration), TRACK (the lifecycle),
// and the live SUBMIT path — are inherently runtime: they mutate state after boot.
// Rather than write back into the seed (which would make the demo non-deterministic
// and burn no quota but lose the frozen baseline), this store holds an in-memory
// OVERLAY keyed by issueId. data.ts merges it onto the seed at read time.
//
// In-memory is the right call for a single-container demo: it survives every
// request within a run, resets cleanly on restart (so the demo always returns to a
// known baseline), and needs no database / billing. Live-submitted issues are held
// here too, so a citizen's report appears in the matrix alongside the seed issues.
//
// This module is pulled into the esbuild CJS bundle. It uses Date.now()/new Date()
// ONLY inside functions (request time), never at module load, so the bundle boots
// clean.
import { clamp01, computeQuadrant } from "../../shared/scoring.ts";
import type { Issue, IssueStatus, StatusEvent, Tracking } from "../../shared/types.ts";
import { logger } from "../lib/logger.ts";
import { loadState, saveState } from "./persistence.ts";

// Each live corroboration adds this much raw attention, clamped to 1. Calibrated
// so a handful of "I see this too" taps visibly move a hidden-crisis issue toward
// the crowd's quadrant without instantly saturating it.
const CORROBORATION_WEIGHT = 0.06;

// The legal lifecycle transitions. A status can only advance along this graph (or
// flip resolved → recurred), so the timeline is always a coherent audit trail.
const NEXT: Record<IssueStatus, IssueStatus[]> = {
  reported: ["acknowledged"],
  acknowledged: ["assigned"],
  assigned: ["resolved"],
  resolved: ["recurred"],
  recurred: ["acknowledged"], // a recurrence re-enters the cycle
};

// The mutable overlay for one issue. Absent fields fall back to the issue's own
// born values when merged.
interface Overlay {
  status: IssueStatus;
  timeline: StatusEvent[];
  assignedAt: string | null;
  corroborations: number;
  baselineAttention: number;
}

const overlays = new Map<string, Overlay>();
// Issues created at runtime by the live-submit pipeline (kept separate from the
// frozen seed so the seed array is never mutated).
const liveIssues: Issue[] = [];

// ── Persistence ─────────────────────────────────────────────────────────────────
// hydrate() is called once by data.ts AFTER the demo lifecycle is seeded, so the
// deterministic baseline is laid down first and the persisted real-world deltas
// (live submissions + any corroboration/advance a visitor performed) replay on top.
let hydrated = false;
export function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const state = loadState();
  if (!state) return;
  for (const i of state.liveIssues) liveIssues.push(i);
  for (const o of state.overlays) {
    overlays.set(o.issueId, {
      status: o.status,
      timeline: o.timeline,
      assignedAt: o.assignedAt,
      corroborations: o.corroborations,
      baselineAttention: o.baselineAttention,
    });
  }
  logger.info(
    { liveIssues: state.liveIssues.length, overlays: state.overlays.length },
    "store_hydrated",
  );
}

// Snapshot the persistable state and write it. Called after every mutation. The
// snapshot is the live issues plus the FULL overlay set — replaying the whole
// overlay set on top of a fresh seed is idempotent, so a restart restores exactly
// the last observed state. Best-effort; a disk failure never breaks the request.
function persist(): void {
  if (!hydrated) return; // don't write during the initial demo seeding
  saveState({
    version: 1,
    liveIssues,
    overlays: [...overlays.entries()].map(([issueId, o]) => ({ issueId, ...o })),
  });
}

// ── Seeding the demo lifecycle ────────────────────────────────────────────────────
// Called once at startup with the seed issues so the 6 demo issues show realistic,
// honest lifecycle states (derived from their own recurrence/memory), not a flat
// "reported". This is disclosed-synthetic like the rest of the corpus: the STATES
// are designed, but the SLA math and the recurred-flip logic are real and live.
export function seedTracking(seed: { issueId: string; attentionScore: number }[]): void {
  for (const s of seed) {
    if (!overlays.has(s.issueId)) {
      overlays.set(s.issueId, {
        status: "reported",
        timeline: [],
        assignedAt: null,
        corroborations: 0,
        baselineAttention: s.attentionScore,
      });
    }
  }
}

// Apply a fully-specified lifecycle to one seeded issue (used by the demo seeding
// in data.ts). The timeline is provided as real ISO dates so SLA-overdue computes
// against the actual clock at request time.
export function setSeedLifecycle(
  issueId: string,
  status: IssueStatus,
  timeline: StatusEvent[],
  assignedAt: string | null,
  corroborations: number,
  baselineAttention: number,
): void {
  overlays.set(issueId, { status, timeline, assignedAt, corroborations, baselineAttention });
}

function ensure(issue: Issue): Overlay {
  let o = overlays.get(issue.issueId);
  if (!o) {
    o = {
      status: "reported",
      timeline: [
        {
          status: "reported",
          at: issue.createdAt,
          note: "Filed by a citizen report",
          actor: "citizen",
        },
      ],
      assignedAt: null,
      corroborations: 0,
      baselineAttention: issue.attentionScore,
    };
    overlays.set(issue.issueId, o);
  }
  return o;
}

// ── Read: merge the overlay onto an issue ─────────────────────────────────────────
// Returns a NEW issue object with a live attentionScore (baseline + corroboration
// bump), a recomputed quadrant, and the tracking block attached. Never mutates the
// seed object.
export function withTracking(issue: Issue): Issue {
  const o = overlays.get(issue.issueId);
  if (!o) {
    // No overlay yet — surface a minimal, honest tracking block so the UI always
    // has the lifecycle to show.
    return {
      ...issue,
      tracking: {
        status: "reported",
        timeline: [
          {
            status: "reported",
            at: issue.createdAt,
            note: "Filed by a citizen report",
            actor: "citizen",
          },
        ],
        assignedAt: null,
        corroborations: 0,
        baselineAttention: issue.attentionScore,
      },
    };
  }
  const liveAttention = clamp01(o.baselineAttention + o.corroborations * CORROBORATION_WEIGHT);
  const tracking: Tracking = {
    status: o.status,
    timeline: o.timeline,
    assignedAt: o.assignedAt,
    corroborations: o.corroborations,
    baselineAttention: o.baselineAttention,
  };
  return {
    ...issue,
    attentionScore: liveAttention,
    quadrant: computeQuadrant(liveAttention, issue.impactScore),
    tracking,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────────

export interface CorroborateResult {
  corroborations: number;
  attentionScore: number;
  baselineAttention: number;
  crossedIntoCrowd: boolean; // the crowd just caught up to the model's ranking
}

// "I see this too" — a citizen corroborates an issue. Bumps the live attention and
// reports whether this tap moved the issue across the attention threshold (the
// crowd catching up to what the model already ranked high).
export function corroborate(issue: Issue): CorroborateResult {
  const o = ensure(issue);
  const before = clamp01(o.baselineAttention + o.corroborations * CORROBORATION_WEIGHT);
  o.corroborations += 1;
  const after = clamp01(o.baselineAttention + o.corroborations * CORROBORATION_WEIGHT);
  const crossedIntoCrowd = before < 0.5 && after >= 0.5;
  logger.info(
    { event: "corroborate", issueId: issue.issueId, corroborations: o.corroborations, after },
    "issue corroborated",
  );
  persist();
  return {
    corroborations: o.corroborations,
    attentionScore: after,
    baselineAttention: o.baselineAttention,
    crossedIntoCrowd,
  };
}

export interface AdvanceResult {
  ok: boolean;
  status: IssueStatus;
  timeline: StatusEvent[];
  reason?: string;
}

// Advance an issue's lifecycle by one legal step (or flip resolved → recurred).
// Records a timeline event with the real clock. Starts the SLA clock on "assigned".
export function advanceStatus(
  issue: Issue,
  to: IssueStatus,
  note: string,
  actor: StatusEvent["actor"],
): AdvanceResult {
  const o = ensure(issue);
  const allowed = NEXT[o.status] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      status: o.status,
      timeline: o.timeline,
      reason: `Cannot move from "${o.status}" to "${to}".`,
    };
  }
  const at = new Date().toISOString();
  o.status = to;
  if (to === "assigned") o.assignedAt = at;
  o.timeline = [...o.timeline, { status: to, at, note, actor }];
  logger.info({ event: "status_advance", issueId: issue.issueId, to }, "issue status advanced");
  persist();
  return { ok: true, status: o.status, timeline: o.timeline };
}

// ── SLA (computed live, never stored) ─────────────────────────────────────────────
export interface SlaState {
  running: boolean;
  dueAt: string | null;
  daysElapsed: number;
  daysRemaining: number; // negative = overdue
  overdue: boolean;
}

// Compute the SLA state of an issue against the wall clock at request time.
export function slaState(issue: Issue, slaDays: number): SlaState {
  const o = overlays.get(issue.issueId);
  if (!o?.assignedAt) {
    return { running: false, dueAt: null, daysElapsed: 0, daysRemaining: slaDays, overdue: false };
  }
  const assigned = new Date(o.assignedAt).getTime();
  const now = Date.now();
  const dayMs = 86_400_000;
  const daysElapsed = Math.floor((now - assigned) / dayMs);
  const daysRemaining = slaDays - daysElapsed;
  const resolved = o.status === "resolved";
  return {
    running: !resolved,
    dueAt: new Date(assigned + slaDays * dayMs).toISOString(),
    daysElapsed,
    daysRemaining,
    overdue: !resolved && daysRemaining < 0,
  };
}

// ── Live-submitted issues ─────────────────────────────────────────────────────────
export function addLiveIssue(issue: Issue): void {
  liveIssues.push(issue);
  ensure(issue);
  persist();
}
export function listLiveIssues(): Issue[] {
  return liveIssues;
}
export function findIssue(id: string): Issue | undefined {
  return liveIssues.find((i) => i.issueId === id);
}
