// COMMONS — the freeze gate.
//
// The agent pipeline ENRICHES the deterministic spine (it fills the null
// resolution/escalation/memory fields and the run trace) but must NEVER change a
// load-bearing number. This harness encodes that contract as two lanes:
//
//   LANE A (numbers frozen): every numeric/structural field that the spine
//     produced — impactScore, attentionScore, quadrant, reversal, the derived
//     handoff.confidence, the ranking — must be byte-identical after enrichment.
//   LANE B (enrichment present): the 5 non-noise issues must have non-null
//     resolution/escalation/memory after enrichment.
//
// Run it BEFORE the agents exist and Lane B FAILS by design (RED) — proving the
// gate reads the spine correctly. Run it AFTER `npm run agents` and both lanes
// pass (GREEN). It is the executable form of "agents add depth, never drift."
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Issue } from "../shared/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "../seed");

const issues = JSON.parse(readFileSync(path.join(SEED, "issues.json"), "utf8")) as Issue[];

let pass = 0;
let fail = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

// The frozen numeric fingerprint of the spine. These are the committed values
// the agents must reproduce exactly. (Source: seed/issues.json after Phase 1.)
const FROZEN: Record<
  string,
  { impact: number; attention: number; quadrant: string; confidence: number; reversal: boolean }
> = {
  ISS_HC1: {
    impact: 81,
    attention: 0.17,
    quadrant: "hidden_crisis",
    confidence: 0.66,
    reversal: true,
  },
  ISS_HC2: {
    impact: 80,
    attention: 0.15,
    quadrant: "hidden_crisis",
    confidence: 0.5,
    reversal: true,
  },
  ISS_HC3: {
    impact: 62,
    attention: 0.23,
    quadrant: "hidden_crisis",
    confidence: 0.67,
    reversal: false,
  },
  ISS_SYN: { impact: 49, attention: 0.3, quadrant: "monitor", confidence: 0.79, reversal: false },
  ISS_REC: { impact: 34, attention: 0.51, quadrant: "noise", confidence: 0.76, reversal: false },
  ISS_NOISE: { impact: 19, attention: 0.78, quadrant: "noise", confidence: 0.86, reversal: false },
};

console.log("[verifyFreeze] LANE A — load-bearing numbers must be byte-frozen…");
for (const [id, f] of Object.entries(FROZEN)) {
  const iss = issues.find((i) => i.issueId === id);
  check(!!iss, `${id} present`);
  if (!iss) continue;
  check(iss.impactScore === f.impact, `${id} impact ${iss.impactScore} === ${f.impact}`);
  check(
    iss.attentionScore === f.attention,
    `${id} attention ${iss.attentionScore} === ${f.attention}`,
  );
  check(iss.quadrant === f.quadrant, `${id} quadrant ${iss.quadrant} === ${f.quadrant}`);
  check(
    iss.handoff.confidence === f.confidence,
    `${id} confidence ${iss.handoff.confidence} === ${f.confidence}`,
  );
  check(
    Boolean(iss.reversal?.overruledAttention) === f.reversal,
    `${id} reversal ${Boolean(iss.reversal?.overruledAttention)} === ${f.reversal}`,
  );
}

console.log(
  "\n[verifyFreeze] LANE B — enrichment must be present (RED before agents, GREEN after)…",
);
const nonNoise = issues.filter((i) => i.issueId !== "ISS_NOISE");
for (const iss of nonNoise) {
  check(iss.resolution !== null, `${iss.issueId} resolution filled`);
  check(iss.escalation !== null, `${iss.issueId} escalation filled`);
  check(iss.memory !== null, `${iss.issueId} memory filled`);
}

console.log(`\n[verifyFreeze] ${pass} passed, ${fail} failed.`);
if (fail > 0) {
  console.error(
    "[verifyFreeze] FAIL. (Before `npm run agents` this is EXPECTED — Lane B is RED. " +
      "After enrichment, both lanes must be GREEN; any Lane-A failure means the agents drifted a frozen number.)",
  );
  process.exit(1);
}
console.log("[verifyFreeze] OK — numbers frozen AND enrichment present.");
