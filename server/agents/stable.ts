// Deterministic JSON — keys sorted recursively, so the same logical object
// always serialises to the same bytes. Used for (a) the cache/inputHash key and
// (b) the frozen seed/issues.json + agentRun.json, so a re-run produces a
// byte-identical file and `git diff` stays empty.
import { createHash } from "node:crypto";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Canonical JSON (sorted keys). `space` matches JSON.stringify's third arg. */
export function stableStringify(value: unknown, space?: number): string {
  return JSON.stringify(sortValue(value), null, space);
}

/** sha256 of the canonical form — a stable content hash. */
export function stableHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}
