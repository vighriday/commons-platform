// On-disk cache for model outputs, keyed by inputHash.
//
// The whole pipeline is run ONCE at build time; every agent's structured output
// is written here so the committed cache pins the (otherwise non-deterministic)
// LLM prose. At demo time the read path serves the frozen seed/issues.json +
// agentRun.json and never calls a model — but if the pipeline is re-run, a cache
// hit returns the same bytes with zero RPD. The cache files are committed so the
// freeze survives a clean checkout.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Cache lives under seed/ so it ships with the repo (committed, not gitignored —
// it IS the frozen prose). Resolve from this module, not cwd, so build scripts
// and the server agree.
const CACHE_DIR = path.resolve(__dirname, "../../seed/agentRuns");

function cachePath(inputHash: string): string {
  return path.join(CACHE_DIR, `${inputHash}.json`);
}

export function readCache<T>(inputHash: string): T | null {
  const p = cachePath(inputHash);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null; // corrupt cache entry → treat as miss
  }
}

export function writeCache(inputHash: string, value: unknown): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(inputHash), JSON.stringify(value, null, 2));
}
