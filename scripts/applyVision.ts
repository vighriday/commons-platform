// Build-time: fold the REAL Gemini Vision output into the report corpus.
//
// genVision.ts produced seed/photoVision.json from real CC-licensed images. This
// rewrites the matching reports in seed/reports.json so their media block carries
// the REAL caption + extracted features + the real (EXIF-stripped) image path —
// replacing the old hand-authored placeholder annotation. Reports that have no
// real image have their fabricated `extracted` block removed (text-only, honest).
//
// Run after genVision, before `npm run agents` (so the evidence agent reads real
// data): npm run seed:vision:apply
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Report } from "../shared/types.ts";

const SEED = path.resolve(process.cwd(), "seed");

interface VisionEntry {
  caption: string;
  observedFeatures: string[];
  severitySignal: number;
  confidence: number;
  web: string;
}

function main(): void {
  const vision = JSON.parse(readFileSync(path.join(SEED, "photoVision.json"), "utf8"))
    .vision as Record<string, VisionEntry>;
  const reports = JSON.parse(readFileSync(path.join(SEED, "reports.json"), "utf8")) as Report[];

  // Reports that referenced a fabricated `extracted` block but have NO real image —
  // strip the fabrication (keep the caption; the photo simply has no analysis).
  const NO_IMAGE = new Set(["R058"]);

  let patched = 0;
  let stripped = 0;
  for (const r of reports) {
    const v = vision[r.reportId];
    const photo = r.media?.find((m) => m.type === "photo");
    if (v && photo) {
      photo.ref = v.web;
      photo.caption = v.caption;
      photo.extracted = {
        observedFeatures: v.observedFeatures,
        severitySignal: v.severitySignal,
        confidence: v.confidence,
      };
      patched++;
    } else if (NO_IMAGE.has(r.reportId) && photo?.extracted) {
      // No real image → remove the fabricated analysis; keep the caption only.
      photo.extracted = null;
      photo.ref = null;
      stripped++;
    }
  }

  writeFileSync(path.join(SEED, "reports.json"), `${JSON.stringify(reports, null, 2)}\n`);
  console.log(
    `applied real vision to ${patched} reports, stripped ${stripped} fabricated block(s)`,
  );
}

main();
