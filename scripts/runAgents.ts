// COMMONS — run the 7-agent pipeline ONCE and freeze the result.
//
// This is the single build-time enrichment pass. It:
//   1. loads the deterministic spine (seed/issues.json + reports + embeddings),
//   2. snapshots every load-bearing number,
//   3. runs the orchestrator once (cache-backed → ~0 RPD on re-runs),
//   4. RE-ASSERTS that no frozen number moved (Lane A of the freeze gate),
//   5. writes the enriched seed/issues.json (now with resolution/escalation/
//      memory) + seed/agentRun.json, via stable-stringify so re-runs are
//      byte-identical and `git diff` stays empty.
// It refuses to write (exit 1) if any load-bearing assertion fails.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geminiUsage, runPipeline } from "../server/agents/orchestrator.ts";
import { stableStringify } from "../server/agents/stable.ts";
import type { Issue, Report } from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "../seed");

const issues = JSON.parse(readFileSync(path.join(SEED, "issues.json"), "utf8")) as Issue[];
const reports = JSON.parse(readFileSync(path.join(SEED, "reports.json"), "utf8")) as Report[];
const embFile = JSON.parse(readFileSync(path.join(SEED, "embeddings.json"), "utf8")) as {
  vectors: Record<string, number[]>;
};

// Snapshot the load-bearing numbers BEFORE enrichment.
const before = new Map(
  issues.map((i) => [
    i.issueId,
    {
      impact: i.impactScore,
      attention: i.attentionScore,
      quadrant: i.quadrant,
      confidence: i.handoff.confidence,
      reversal: Boolean(i.reversal?.overruledAttention),
    },
  ]),
);

console.log(`[runAgents] enriching ${issues.length} issues via the 7-agent pipeline…`);

const { enrichedIssues, agentRun } = await runPipeline(issues, reports, embFile.vectors);

// ── Lane A: assert no load-bearing number moved ──
let drift = 0;
for (const iss of enrichedIssues) {
  const b = before.get(iss.issueId)!;
  const checks: [string, boolean][] = [
    ["impact", iss.impactScore === b.impact],
    ["attention", iss.attentionScore === b.attention],
    ["quadrant", iss.quadrant === b.quadrant],
    ["confidence", iss.handoff.confidence === b.confidence],
    ["reversal", Boolean(iss.reversal?.overruledAttention) === b.reversal],
  ];
  for (const [name, ok] of checks) {
    if (!ok) {
      console.error(`  ✗ ${iss.issueId} ${name} DRIFTED`);
      drift++;
    }
  }
}
if (drift > 0) {
  console.error(`[runAgents] ABORT — ${drift} load-bearing number(s) drifted. Nothing written.`);
  process.exit(1);
}

// ── Lane B: assert enrichment is present on the non-noise issues ──
let missing = 0;
for (const iss of enrichedIssues.filter((i) => i.issueId !== "ISS_NOISE")) {
  if (!iss.resolution) {
    console.error(`  ✗ ${iss.issueId} resolution missing`);
    missing++;
  }
  if (!iss.escalation) {
    console.error(`  ✗ ${iss.issueId} escalation missing`);
    missing++;
  }
  if (!iss.memory) {
    console.error(`  ✗ ${iss.issueId} memory missing`);
    missing++;
  }
}
if (missing > 0) {
  console.error(`[runAgents] ABORT — ${missing} enrichment field(s) missing. Nothing written.`);
  process.exit(1);
}

// ── Write the frozen artifacts (stable bytes) ──
writeFileSync(path.join(SEED, "issues.json"), stableStringify(enrichedIssues, 2));
writeFileSync(path.join(SEED, "agentRun.json"), stableStringify(agentRun, 2));

const usage = geminiUsage();
console.log(`[runAgents] OK — wrote enriched issues.json + agentRun.json.`);
console.log(
  `[runAgents] steps: ${agentRun.steps.length}, reversal: ${agentRun.reversal?.promotedIssueId} over ${agentRun.reversal?.overruledIssueId}`,
);
console.log(
  `[runAgents] RPD this run — flash ${usage.flash}, flash-lite ${usage.flashLite}, cache hits ${usage.cacheHits}.`,
);
