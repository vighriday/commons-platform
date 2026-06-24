// COMMONS — verify the committed seed against its load-bearing invariants.
//
// Re-checks the seed/issues WITHOUT regenerating, so it can run anywhere (CI,
// pre-deploy, on stage) to prove the demo guarantees still hold. Exits non-zero
// on any violation. This is the auditable "the numbers are real" harness.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeImpact, finalRank } from "../shared/scoring.ts";
import { severityNorm } from "../seed/severityTable.ts";
import type { Issue, Report } from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "../seed");

const reports = JSON.parse(readFileSync(path.join(SEED, "reports.json"), "utf8")) as Report[];
const issues = JSON.parse(readFileSync(path.join(SEED, "issues.json"), "utf8")) as Issue[];
const expGrid = JSON.parse(readFileSync(path.join(SEED, "exposureGrid.json"), "utf8")) as { plusCellId: string }[];

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
}

console.log("[verify-seed] checking load-bearing invariants…");

// Corpus shape
check(reports.length === 96, `corpus has 96 reports (got ${reports.length})`);
const tally: Record<string, number> = {};
for (const r of reports) tally[r.category] = (tally[r.category] ?? 0) + 1;
check(tally.roads === 25 && tally.water === 14 && tally.drainage === 15, "category distribution matches locked targets");

// Every report's cell is grounded
const cells = new Set(expGrid.map((c) => c.plusCellId));
check(reports.every((r) => cells.has(r.location.plusCellId)), "every report's plusCell exists in exposureGrid");

// Planted patterns present
const patterns = new Set(reports.map((r) => r.seed.plantedPatternId).filter(Boolean));
for (const p of ["synthesis", "hiddenCrisis1", "hiddenCrisis2", "hiddenCrisis3", "recurrence", "noise", "liveDemo", "spam"]) {
  check(patterns.has(p), `planted pattern present: ${p}`);
}

// The locked demo guarantees
const hc1 = issues.find((i) => i.issueId === "ISS_HC1");
check(!!hc1 && hc1.impactScore === 81, `HC-1 impact = 81 (got ${hc1?.impactScore})`);
check(!!hc1 && hc1.quadrant === "hidden_crisis", "HC-1 is in hidden_crisis quadrant");
check(!!hc1?.reversal?.overruledAttention, "HC-1 reversal overrules attention");
check(finalRank(issues)[0]?.issueId === "ISS_HC1", "HC-1 ranks #1 by impact");
const noise = issues.find((i) => i.issueId === "ISS_NOISE");
check(!!noise && noise.quadrant === "noise", "pothole is in noise quadrant");

// Impact is recomputable (not hardcoded) — recompute HC-1 from its factors
if (hc1) {
  const recomputed = computeImpact(severityNorm(hc1.severity.row), hc1.exposure.value, hc1.vulnerability.value);
  check(recomputed === hc1.impactScore, `HC-1 impact recomputes from factors (${recomputed} === ${hc1.impactScore})`);
}

if (failures > 0) {
  console.error(`\n[verify-seed] FAILED: ${failures} invariant(s) violated.`);
  process.exit(1);
}
console.log("\n[verify-seed] OK — all invariants hold.");
