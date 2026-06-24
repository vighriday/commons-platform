// COMMONS — generate the Time Machine snapshots (deterministic).
//
// Replays the issue set at fixed month-end dates so the dashboard can scrub the
// past 5 months and SEE the contradiction build: the pothole's attention climbs
// loud while its impact stays low (NOISE), and the Agara Lake drain (HC-1) sits
// quietly high-impact / low-attention the whole time (the silent crisis).
//
// Grounded in the REAL report timeline: each issue "emerges" when its first
// contributing report lands; per frame, attention scales with the fraction of
// its reports seen so far, and impact accrues monotonically to the committed
// final value. The LAST frame equals the frozen issues.json exactly. Quadrants
// are recomputed with the same shared/scoring.ts thresholds — nothing hand-set.
//
// import.meta.url is safe here: this is a build-time tsx (ESM) script, never
// bundled into the CJS server. The server reads the output via process.cwd().
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeQuadrant } from "../shared/scoring.ts";
import type { CivicPulse, Issue, Report, Snapshot, TwinDoc } from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "../seed");
const WARD = "blr-174-hsr";

const issues = JSON.parse(readFileSync(path.join(SEED, "issues.json"), "utf8")) as Issue[];
const reports = JSON.parse(readFileSync(path.join(SEED, "reports.json"), "utf8")) as Report[];
const byId = new Map(reports.map((r) => [r.reportId, r]));

// Fixed month-end frames — the scrub window where the story plays out. The last
// frame is dated after the latest contributing report (SYN's runs to Jul 2025),
// so every issue's evidence is fully in and the final frame lands exactly on the
// committed issues.json numbers.
const FRAMES = [
  "2025-02-28T23:59:59.000Z",
  "2025-03-31T23:59:59.000Z",
  "2025-04-30T23:59:59.000Z",
  "2025-05-31T23:59:59.000Z",
  "2025-06-30T23:59:59.000Z",
  "2025-07-31T23:59:59.000Z",
];

// For an issue at time `t`, how much of its evidence has arrived?
function reportsSeen(issue: Issue, t: number): Report[] {
  return issue.contributingReports
    .map((id) => byId.get(id))
    .filter((r): r is Report => Boolean(r) && new Date(r!.createdAt).getTime() <= t);
}

// Per-frame scores: impact accrues with evidence toward the final committed
// value; attention reflects the cumulative community signal at that moment.
function frameScores(issue: Issue, t: number): { impactScore: number; attentionScore: number } {
  const seen = reportsSeen(issue, t);
  if (seen.length === 0) return { impactScore: 0, attentionScore: 0 };
  const frac = seen.length / issue.contributingReports.length;

  // Impact ramps from a floor to its final value as evidence corroborates it —
  // a hidden crisis is ALREADY dangerous on the first report, so the floor is
  // high (0.7 of final); the final frame always lands exactly on the committed
  // number (frac === 1).
  const impactScore = Math.round(issue.impactScore * (0.7 + 0.3 * frac));

  // Attention scales with the share of reports + their engagement seen so far —
  // the loud pothole climbs fast (many reports), the quiet drain barely moves.
  const attentionScore = Math.round(issue.attentionScore * frac * 100) / 100;

  return { impactScore, attentionScore };
}

// A light twin per frame (infraHealth tracks the worsening mean impact). The
// full exposureGrid is carried so the Twin view can read any frame if needed.
function frameTwin(base: TwinDoc, frameImpacts: number[]): TwinDoc {
  const mean = frameImpacts.length
    ? frameImpacts.reduce((s, n) => s + n, 0) / frameImpacts.length
    : 0;
  return { ...base, infraHealth: Math.round(100 - mean) };
}

const baseTwin: TwinDoc = {
  wardId: WARD,
  name: "HSR Layout (BBMP Ward 174)",
  infraHealth: 46,
  issueVelocity: 0,
  issueDensity: 0,
  engagementIndex: 0,
  resolutionEffectiveness: 0,
  emergingRisks: [],
  exposureGrid: [],
  lastSnapshotId: "",
};

const snapshots: Snapshot[] = FRAMES.map((iso) => {
  const t = new Date(iso).getTime();
  const quadrantState = issues.map((issue) => {
    const { impactScore, attentionScore } = frameScores(issue, t);
    return {
      issueId: issue.issueId,
      attentionScore,
      impactScore,
      quadrant: computeQuadrant(attentionScore, impactScore),
      emerged: reportsSeen(issue, t).length > 0,
    };
  });

  const active = quadrantState.filter((q) => q.emerged);
  const emergingRisks = [...active]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3)
    .map((q) => issues.find((i) => i.issueId === q.issueId)!.title);

  const loudest = [...active].sort((a, b) => b.attentionScore - a.attentionScore)[0];
  const topImpact = [...active].sort((a, b) => b.impactScore - a.impactScore)[0];

  const summary: CivicPulse = {
    status: active.length === 0 ? "Quiet" : "Active",
    emergingRisk: topImpact ? issues.find((i) => i.issueId === topImpact.issueId)!.title : "—",
    mostIgnoredProblem: topImpact
      ? issues.find((i) => i.issueId === topImpact.issueId)!.title
      : "—",
    attentionPattern: loudest
      ? `Loudest: ${issues.find((i) => i.issueId === loudest.issueId)!.title}`
      : "—",
    civicBlindSpot:
      loudest && topImpact && loudest.issueId !== topImpact.issueId
        ? `Loudest is "${issues.find((i) => i.issueId === loudest.issueId)!.title}", but the top risk is "${issues.find((i) => i.issueId === topImpact.issueId)!.title}".`
        : "—",
    resolutionBottleneck: "—",
    priorityRecommendation: topImpact
      ? issues.find((i) => i.issueId === topImpact.issueId)!.title
      : "—",
    narrative: `As of ${iso.slice(0, 10)}, ${active.length} issues have surfaced in HSR Layout.`,
  };

  return {
    wardId: WARD,
    takenAt: iso,
    // Strip the helper `emerged` flag from the persisted quadrantState (keep the type clean).
    quadrantState: quadrantState.map(({ emerged: _e, ...q }) => q),
    twin: {
      ...frameTwin(
        baseTwin,
        active.map((q) => q.impactScore),
      ),
      emergingRisks,
    },
    summary,
  };
});

// ── Assertions: the story + the frozen-fingerprint consistency ───────────────────
function assert(c: boolean, m: string): void {
  if (!c) {
    console.error(`[genSnapshots] FAIL: ${m}`);
    process.exit(1);
  }
}

assert(snapshots.length >= 4, `≥4 snapshots (got ${snapshots.length})`);
// takenAt strictly ascending
for (let i = 1; i < snapshots.length; i++) {
  assert(
    new Date(snapshots[i].takenAt) > new Date(snapshots[i - 1].takenAt),
    "frames strictly ascending",
  );
}
// The LAST frame must reproduce the committed issues.json exactly (all reports seen).
const last = snapshots[snapshots.length - 1];
for (const issue of issues) {
  const q = last.quadrantState.find((s) => s.issueId === issue.issueId)!;
  assert(
    q.impactScore === issue.impactScore,
    `${issue.issueId} final impact ${q.impactScore} === ${issue.impactScore}`,
  );
  assert(
    q.attentionScore === issue.attentionScore,
    `${issue.issueId} final attention ${q.attentionScore} === ${issue.attentionScore}`,
  );
  assert(
    q.quadrant === issue.quadrant,
    `${issue.issueId} final quadrant ${q.quadrant} === ${issue.quadrant}`,
  );
}
// The story: by the LAST frame, the pothole is louder than HC-1 but lower impact.
const potLast = last.quadrantState.find((s) => s.issueId === "ISS_NOISE")!;
const hc1Last = last.quadrantState.find((s) => s.issueId === "ISS_HC1")!;
assert(potLast.attentionScore > hc1Last.attentionScore, "pothole louder than HC-1");
assert(hc1Last.impactScore > potLast.impactScore, "HC-1 higher impact than pothole");

writeFileSync(path.join(SEED, "snapshots.json"), JSON.stringify(snapshots, null, 2));
console.log(`[genSnapshots] OK — ${snapshots.length} frames written.`);
for (const s of snapshots) {
  const pot = s.quadrantState.find((q) => q.issueId === "ISS_NOISE")!;
  const hc1 = s.quadrantState.find((q) => q.issueId === "ISS_HC1")!;
  console.log(
    `  ${s.takenAt.slice(0, 10)}  pothole att ${pot.attentionScore.toFixed(2)} imp ${String(pot.impactScore).padStart(2)} ${pot.quadrant.padEnd(13)} | HC-1 att ${hc1.attentionScore.toFixed(2)} imp ${hc1.impactScore} ${hc1.quadrant}`,
  );
}
