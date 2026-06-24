#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Pre-deploy guard: fail the build if a secret leaked into the client bundle.
//
// The Gemini API key is server-side only. It must NEVER appear in dist/.
// This script scans the built client assets for the live key value and for
// any accidental VITE_-prefixed Gemini key, and exits non-zero if found.
// Run automatically via `npm run predeploy`.
// ─────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const failures = [];

// The actual secret value, if present in this environment, must not be in dist.
const liveKey = process.env.GEMINI_API_KEY?.trim();

// Patterns that should never appear in a client bundle.
const forbiddenPatterns = [
  /VITE_GEMINI_API_KEY/,
  /VITE_GOOGLE_API_KEY/,
  /AIza[0-9A-Za-z_-]{35}/, // legacy Google API key shape
  /AQ\.[A-Za-z0-9_-]{30,}/, // current (2026) Gemini AI Studio key shape ("AQ." prefix)
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(js|mjs|cjs|html|css|map)$/.test(entry)) {
      const text = readFileSync(full, "utf8");
      if (liveKey && liveKey.length > 8 && text.includes(liveKey)) {
        failures.push(`Live GEMINI_API_KEY value found in ${full}`);
      }
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(text)) {
          failures.push(`Forbidden pattern ${pattern} found in ${full}`);
        }
      }
    }
  }
}

if (!existsSync(DIST)) {
  console.error(`[checkBundleSecrets] No ${DIST}/ directory — run the build first.`);
  process.exit(1);
}

walk(DIST);

if (failures.length > 0) {
  console.error("\n[checkBundleSecrets] SECRET LEAK DETECTED — deploy blocked:\n");
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("\nThe Gemini key is server-side only. Remove it from the client.\n");
  process.exit(1);
}

console.log("[checkBundleSecrets] OK — no secrets found in the client bundle.");
