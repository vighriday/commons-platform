// COMMONS — disk persistence for the runtime store.
//
// The seed issues are frozen and re-seeded to a known baseline on every boot (so
// the demo is deterministic). But two things SHOULD survive a restart: the live
// citizen submissions, and any lifecycle/corroboration a visitor performed. Those
// are written to a single JSON file and replayed on boot AFTER the demo seeding,
// so the baseline is restored first and the real-world deltas layer on top.
//
// Storage choice (card-free, zero-dep): a JSON file under a writable data dir.
//   • Local dev  → <repo>/.data/live-state.json
//   • Cloud Run  → $DATA_DIR (set to /tmp, the only reliably-writable path) — the
//     keep-warm ping (.github/workflows/ping.yml) holds the container up so the
//     /tmp file persists across the demo window. Not a durable DB; an honest,
//     billing-free store that survives warm restarts.
//
// Writes are ATOMIC (write a temp file, then rename) so a crash mid-write can never
// leave a half-written, unparseable file. Resolves paths from process.cwd()/env —
// never import.meta.url — so it works in the esbuild CJS bundle.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Issue, IssueStatus, StatusEvent } from "../../shared/types.ts";
import { logger } from "../lib/logger.ts";

// The persisted overlay for one issue (mirrors the in-memory Overlay shape).
export interface PersistedOverlay {
  issueId: string;
  status: IssueStatus;
  timeline: StatusEvent[];
  assignedAt: string | null;
  corroborations: number;
  baselineAttention: number;
}

export interface PersistedState {
  version: 1;
  liveIssues: Issue[];
  overlays: PersistedOverlay[];
}

// Candidate data dirs in priority order. $DATA_DIR (if set) wins; then a .data
// dir next to the app (writable in local dev); then the OS temp dir (os.tmpdir()
// === /tmp on Cloud Run, the one path the managed container can always write).
// The first one we can actually create/write to is used. This makes persistence
// work on Cloud Run with NO Dockerfile/env change — it auto-falls-back to /tmp.
const CANDIDATES = [
  process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null,
  path.resolve(process.cwd(), ".data"),
  path.join(os.tmpdir(), "commons-data"),
].filter((d): d is string => Boolean(d));

function pickWritableDir(): string | null {
  for (const dir of CANDIDATES) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Prove it's actually writable, not just creatable.
      const probe = path.join(dir, ".write-probe");
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe);
      return dir;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

const DATA_DIR = pickWritableDir();
const FILE = DATA_DIR ? path.join(DATA_DIR, "live-state.json") : "";
const TMP = `${FILE}.tmp`;

// Whether persistence is usable. If no candidate dir is writable (a fully
// read-only FS), the store silently falls back to in-memory only; the app still
// works, submits just don't survive a restart.
const enabled = Boolean(DATA_DIR);
if (enabled) {
  logger.info({ dir: DATA_DIR }, "persistence_enabled");
} else {
  logger.warn({ candidates: CANDIDATES }, "persistence_disabled_no_writable_dir");
}

// Load the persisted state on boot. Returns null if nothing saved yet, persistence
// is disabled, or the file is unreadable/corrupt (in which case we start clean
// rather than crash — a bad save must never brick boot).
export function loadState(): PersistedState | null {
  if (!enabled || !fs.existsSync(FILE)) return null;
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1 || !Array.isArray(parsed.liveIssues)) {
      logger.warn({ file: FILE }, "persistence_bad_shape_ignored");
      return null;
    }
    logger.info(
      { liveIssues: parsed.liveIssues.length, overlays: parsed.overlays?.length ?? 0 },
      "persistence_loaded",
    );
    return parsed;
  } catch (err) {
    logger.warn({ err, file: FILE }, "persistence_load_failed_starting_clean");
    return null;
  }
}

// Atomically write the current state. Best-effort: a write failure is logged but
// never thrown to the request path (a citizen's submission still succeeds in
// memory even if the disk write fails).
export function saveState(state: PersistedState): void {
  if (!enabled) return;
  try {
    fs.writeFileSync(TMP, JSON.stringify(state), "utf8");
    fs.renameSync(TMP, FILE); // atomic on the same filesystem
  } catch (err) {
    logger.warn({ err, file: FILE }, "persistence_save_failed");
  }
}

export function persistenceEnabled(): boolean {
  return enabled;
}
export function persistencePath(): string {
  return FILE;
}
