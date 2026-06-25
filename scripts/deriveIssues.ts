// COMMONS — derive the issue set from the seed corpus (deterministic spine).
//
// Groups planted reports into issues, computes Severity × Exposure × Vulnerability
// → Impact, Attention, quadrant, confidence, and the critique reversal — all from
// the auditable scoring math (no LLM). This is the Phase-1 spine; in Phase 2 the
// real agent pipeline produces the same issue shape with live reasoning + the
// resolution/escalation/memory fields. Writes seed/issues.json.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLANTED_CELLS, cellByKey } from "../seed/plusCodes.ts";
import { severityLabel, severityNorm } from "../seed/severityTable.ts";
import {
  computeAttention,
  computeImpact,
  computeQuadrant,
  deriveConfidence,
  finalRank,
  isReversal,
  meanPairwiseCosine,
} from "../shared/scoring.ts";
import type {
  AgentHandoff,
  Category,
  ExposureFactor,
  Issue,
  IssueType,
  Report,
  VulnerabilityFactor,
} from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "../seed");
const WARD = "blr-174-hsr";

const reports = JSON.parse(readFileSync(path.join(SEED, "reports.json"), "utf8")) as Report[];
const expGrid = JSON.parse(readFileSync(path.join(SEED, "exposureGrid.json"), "utf8")) as Record<
  string,
  unknown
>[];
const vulGrid = JSON.parse(
  readFileSync(path.join(SEED, "vulnerabilityGrid.json"), "utf8"),
) as Record<string, unknown>[];
const embFile = JSON.parse(readFileSync(path.join(SEED, "embeddings.json"), "utf8")) as {
  vectors: Record<string, number[]>;
};
const vectors = embFile.vectors;

const expByCell = new Map(expGrid.map((c) => [c.plusCellId as string, c]));
const vulByCell = new Map(vulGrid.map((c) => [c.plusCellId as string, c]));

const byId = new Map(reports.map((r) => [r.reportId, r]));
const maxEngagement = Math.max(
  ...reports.map((r) => r.engagement.upvotes + 2 * r.engagement.replies),
  1,
);
const times = reports.map((r) => new Date(r.createdAt).getTime());
const minT = Math.min(...times),
  maxT = Math.max(...times);
const recency = (iso: string) =>
  maxT === minT ? 1 : (new Date(iso).getTime() - minT) / (maxT - minT);

interface PlantedDef {
  id: string;
  type: IssueType;
  title: string;
  cellKey: keyof typeof PLANTED_CELLS;
  category: Category;
  severityRow: number;
  reportIds: string[];
}

// Severity rows from the locked table (seed-design §1 + addendum).
const PLANTED: PlantedDef[] = [
  {
    id: "ISS_HC1",
    type: "hidden_crisis",
    title: "Stormwater drain choke near Agara Lake — silent flood risk",
    cellKey: "hiddenCrisis1",
    category: "drainage",
    severityRow: 5,
    reportIds: ["R033", "R077"],
  },
  {
    id: "ISS_HC2",
    type: "hidden_crisis",
    title: "Load-bearing wall crack, Somasundarapalya tenement block",
    cellKey: "hiddenCrisis2",
    category: "structural",
    severityRow: 5,
    reportIds: ["R064"],
  },
  {
    id: "ISS_HC3",
    type: "hidden_crisis",
    title: "Streetlight blackout on ORR service road — pedestrian risk",
    cellKey: "hiddenCrisis3",
    category: "streetlights",
    severityRow: 4,
    reportIds: ["R049", "R069"],
  },
  {
    id: "ISS_SYN",
    type: "synthesis",
    title: "Failing trunk water main under 27th Main, Sector 1 — pre-rupture",
    cellKey: "synthesis",
    category: "water",
    severityRow: 5,
    reportIds: ["R041", "R058", "R072", "R086"],
  },
  {
    id: "ISS_REC",
    type: "recurrence",
    title: "Recurring Drainage Infrastructure Failure — 14th Main x 1st Cross",
    cellKey: "recurrence",
    category: "drainage",
    severityRow: 4,
    reportIds: ["R028", "R055", "R083"],
  },
  {
    id: "ISS_NOISE",
    type: "noise",
    title: "Pothole on 17th Cross, Sector 7",
    cellKey: "noise",
    category: "roads",
    severityRow: 2,
    reportIds: ["R047", "R051", "R052", "R060", "R068", "R074", "R081"],
  },
];

function buildIssue(def: PlantedDef): Issue {
  const cell = cellByKey(PLANTED_CELLS[def.cellKey]);
  const exp = expByCell.get(cell.plusCellId)!;
  const vul = vulByCell.get(cell.plusCellId)!;
  const members = def.reportIds.map((id) => byId.get(id)!).filter(Boolean);

  const sevNorm = severityNorm(def.severityRow);
  const exposureVal = exp.exposure as number;
  const vulnVal = vul.value as number;
  const impactScore = computeImpact(sevNorm, exposureVal, vulnVal);

  const alarmMean = members.reduce((s, r) => s + r.alarmIntensity, 0) / members.length;
  const upvotes = members.reduce((s, r) => s + r.engagement.upvotes, 0);
  const replies = members.reduce((s, r) => s + r.engagement.replies, 0);
  const recencyNorm = Math.max(...members.map((r) => recency(r.createdAt)));
  const attentionScore = computeAttention({
    alarmIntensityMean: alarmMean,
    upvotes,
    replies,
    maxWardEngagement: maxEngagement,
    recencyNorm,
  });

  const quadrant = computeQuadrant(attentionScore, impactScore);

  const vecs = def.reportIds.map((id) => vectors[id]).filter(Boolean);
  const mpc = meanPairwiseCosine(vecs);
  const conf = deriveConfidence({
    contributingCount: members.length,
    adminLevel: "district",
    meanPairwiseCosine: mpc,
  });

  const handoff: AgentHandoff = {
    claim: def.title,
    evidence: members.map((r) => ({ reportId: r.reportId, field: "text", value: r.text })),
    confidence: conf.value,
    uncertainty: `Vulnerability is a ${vul.adminLevel}-level proxy${conf.singleSource ? "; single-source report" : ""}.`,
  };

  const exposure: ExposureFactor = {
    value: exposureVal,
    source: "open_buildings",
    provenance: "curated", // design-locked, calibrated to the Open Buildings method
    inputs: {
      densityNorm: exp.densityNorm as number,
      heightNorm: exp.heightNorm as number,
      changeNorm: exp.changeNorm as number,
    },
  };
  const vulnerability: VulnerabilityFactor = {
    value: vulnVal,
    source: "data_commons",
    adminLevel: "district",
    lowGranularityWarning: true,
    provenance: "curated", // deprivation input real (Census 2011); per-cell value design-locked
    inputs: {
      deprivationNorm: vul.deprivationNorm as number,
      floodProneFlag: vul.floodProneFlag as number,
    },
  };

  return {
    issueId: def.id,
    wardId: WARD,
    type: def.type,
    title: def.title,
    plusCellId: cell.plusCellId,
    contributingReports: def.reportIds,
    category: def.category,
    handoff,
    severity: {
      row: def.severityRow,
      label: severityLabel(def.category, def.severityRow),
      norm: sevNorm,
    },
    exposure,
    vulnerability,
    impactScore,
    attentionScore,
    quadrant,
    recurrence:
      def.type === "recurrence"
        ? {
            count: members.length,
            spanDays: Math.round(
              (new Date(members[members.length - 1].createdAt).getTime() -
                new Date(members[0].createdAt).getTime()) /
                86400000,
            ),
          }
        : null,
    reversal: null, // filled after ranking
    resolution: null,
    escalation: null,
    memory: null, // Phase 2 (agents)
    synthesis: null, // filled by the synthesis agent on synthesis clusters
    createdAt: members[members.length - 1].createdAt,
  };
}

const issues = PLANTED.map(buildIssue);

// ── Compute the critique reversal (HC-1 overrules the pothole) ───────────────────
const byImpact = finalRank(issues);
const byAttention = [...issues].sort((a, b) => b.attentionScore - a.attentionScore);
const impactRankOf = (id: string) => byImpact.findIndex((i) => i.issueId === id) + 1;
const attentionRankOf = (id: string) => byAttention.findIndex((i) => i.issueId === id) + 1;

// Reversal threshold: a rank gap of ≥4 across the derived issue set (the same
// proportional signal as "≫5 ranks" in the full report space — here the issue
// set is small, so the gap is measured among issues). HC-1 sits at impact-rank 1
// but attention-rank 5: a clear overrule of the crowd's attention.
const REVERSAL_DELTA = 4;
for (const iss of issues) {
  const ir = impactRankOf(iss.issueId);
  const ar = attentionRankOf(iss.issueId);
  if (isReversal(ir, ar, REVERSAL_DELTA)) {
    iss.reversal = {
      overruledAttention: true,
      attentionRank: ar,
      impactRank: ir,
      reason: `Impact ${iss.impactScore} (exposure ${iss.exposure.value} from Open Buildings × vulnerability ${iss.vulnerability.value} from Data Commons) overrules low attention ${iss.attentionScore}.`,
    };
  }
}

// ── Assertions: the locked demo guarantees ───────────────────────────────────────
function assert(c: boolean, m: string) {
  if (!c) {
    console.error(`[deriveIssues] FAIL: ${m}`);
    process.exit(1);
  }
}
const top = finalRank(issues)[0];
assert(
  top.issueId === "ISS_HC1",
  `expected HC-1 #1, got ${top.issueId} (impact ${top.impactScore})`,
);
assert(top.impactScore === 81, `expected HC-1 impact 81, got ${top.impactScore}`);
const noise = issues.find((i) => i.issueId === "ISS_NOISE")!;
assert(noise.quadrant === "noise", `expected pothole NOISE, got ${noise.quadrant}`);
assert(
  issues.find((i) => i.issueId === "ISS_HC1")!.reversal?.overruledAttention === true,
  "HC-1 reversal not set",
);

writeFileSync(path.join(SEED, "issues.json"), JSON.stringify(issues, null, 2));
console.log(`[deriveIssues] OK — ${issues.length} issues. Ranking (impact desc):`);
finalRank(issues).forEach((i, n) =>
  console.log(
    `  #${n + 1} ${i.issueId.padEnd(10)} impact ${String(i.impactScore).padStart(3)} att ${i.attentionScore.toFixed(2)} ${i.quadrant}${i.reversal ? " ⟲REVERSAL" : ""}`,
  ),
);
