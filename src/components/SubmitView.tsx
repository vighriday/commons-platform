// COMMONS — the live-submission view.
//
// A citizen (or a judge) files a real report: text + category + a point in the
// ward + an optional photo. On submit, the REAL pipeline runs on the server
// (Gemini Vision reads the photo, classifies severity, scores it, clusters it,
// drafts the plan) and the live trace + the born issue come back. This is the
// proof the engine is real, not a replay — every step is labelled live vs
// computed, and a flagged prompt-injection is shown as a blocked attack.
import type { Issue } from "@shared/types.ts";
import { useState } from "react";
import { type LiveStep, SubmitError, type SubmitResult, api } from "../lib/api.ts";
import { WARD_CENTER } from "../lib/twinGeo.ts";
import { useTwinStore } from "../lib/twinStore.ts";
import { IconAlert, IconSubmit } from "./icons.tsx";

const CATEGORIES = [
  "drainage",
  "water",
  "roads",
  "waste",
  "streetlights",
  "structural",
  "parks",
  "traffic",
  "other",
] as const;

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: SubmitResult }
  | { kind: "quarantined"; reason: string }
  | { kind: "error"; message: string };

export function SubmitView({ onSelectIssue }: { onSelectIssue: (issue: Issue) => void }) {
  // The form draft lives in the store so it survives tab switches (this component
  // unmounts when another view shows). The transient run/spinner state stays local.
  const draft = useTwinStore((s) => s.submitDraft);
  const setDraft = useTwinStore((s) => s.setSubmitDraft);
  const resetDraft = useTwinStore((s) => s.resetSubmitDraft);

  const text = draft?.text ?? "";
  const category = draft?.category ?? "drainage";
  const lat = draft?.lat || WARD_CENTER.lat;
  const lng = draft?.lng || WARD_CENTER.lng;
  const photo = draft?.photo ?? null;
  const suggest = draft?.suggest ?? null;

  const setText = (v: string) => setDraft({ text: v });
  const setCategory = (v: string) => setDraft({ category: v });
  const setLat = (v: number) => setDraft({ lat: v });
  const setLng = (v: number) => setDraft({ lng: v });
  const setPhoto = (v: File | null) => setDraft({ photo: v });

  // Run/spinner state is transient. But a completed result is persisted in the
  // draft, so coming back to the tab still shows the born issue — rehydrate from it.
  const [status, setStatus] = useState<Status>(
    draft?.result ? { kind: "done", result: draft.result } : { kind: "idle" },
  );
  const [suggesting, setSuggesting] = useState(false);

  async function readCategory() {
    if (text.trim().length < 8) return;
    setSuggesting(true);
    setDraft({ suggest: null });
    try {
      const c = await api.classify(text.trim());
      if (c.suggested) setDraft({ suggest: c });
    } catch {
      /* best-effort — the manual picker still works */
    } finally {
      setSuggesting(false);
    }
  }

  async function run() {
    setStatus({ kind: "running" });
    try {
      const result = await api.submit({ text, category, lat, lng, photo });
      setDraft({ result });
      setStatus({ kind: "done", result });
    } catch (e) {
      if (e instanceof SubmitError && e.status === 422) {
        const reason =
          (e.detail as { quarantine?: { reason?: string } })?.quarantine?.reason ??
          "Flagged as a prompt-injection attempt.";
        setStatus({ kind: "quarantined", reason });
      } else if (e instanceof SubmitError && e.status === 400) {
        setStatus({
          kind: "error",
          message: "Check the fields — the point must be inside the ward.",
        });
      } else if (e instanceof SubmitError && (e.status === 413 || e.status === 415)) {
        setStatus({
          kind: "error",
          message: "That image was rejected (too large, or not a JPEG/PNG/WebP).",
        });
      } else if (e instanceof SubmitError && e.status === 429) {
        setStatus({
          kind: "error",
          message:
            "Too many submissions this hour — the live pipeline is rate-limited to protect quota.",
        });
      } else {
        setStatus({ kind: "error", message: "The pipeline could not complete. Please try again." });
      }
    }
  }

  const canRun = text.trim().length >= 8 && status.kind !== "running";

  return (
    <div className="mx-auto max-w-[1400px] px-7 py-7">
      <header className="mb-7 animate-rise">
        <div className="label">Live submission · runs the real pipeline</div>
        <h1
          className="mt-2 max-w-3xl font-semibold text-ink"
          style={{
            fontSize: "var(--text-display)",
            lineHeight: "var(--text-display--line-height)",
            letterSpacing: "var(--text-display--letter-spacing)",
          }}
        >
          File a report — watch COMMONS reason it through, live
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          This is not a replay. Your text and photo are run through the real Gemini pipeline on the
          server — read, scored, clustered, and routed to the responsible authority — behind the
          same safety guardrails (injection filter, upload limits, validation, rate limit).
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          The issue you create is <span className="text-ink-muted">saved on the live server</span> —
          it joins the Matrix and stays fully trackable. (Session-persisted, card-free — no external
          database.)
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── The form ── */}
        <section className="animate-rise rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
          <Field label="What's the problem?">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="e.g. Stormwater drain choked with silt near Agara Lake road, water not draining, smell getting worse."
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand"
            />
            <span className="mt-1 block text-right font-data text-[10px] text-ink-faint">
              {text.length}/5000
            </span>
            <button
              type="button"
              disabled={text.trim().length < 8 || suggesting}
              onClick={readCategory}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              {suggesting ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-line border-t-brand" />
              ) : (
                <IconSubmit size={12} />
              )}
              {suggesting ? "Reading…" : "Let the AI read the category"}
            </button>
          </Field>

          <Field label="Category">
            {suggest && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-brand/40 bg-brand/[0.06] px-2.5 py-1.5 text-[11px]">
                <span className="text-ink-muted">
                  AI reads this as{" "}
                  <span className="font-medium capitalize text-brand">{suggest.suggested}</span>{" "}
                  <span className="font-data text-ink-faint">
                    ({Math.round(suggest.confidence * 100)}%)
                  </span>
                </span>
                {suggest.suggested !== category && (
                  <button
                    type="button"
                    onClick={() => setCategory(suggest.suggested)}
                    className="ml-auto rounded border border-brand/50 px-1.5 py-0.5 font-data text-[10px] text-brand transition-colors hover:bg-brand/10"
                  >
                    apply
                  </button>
                )}
                {suggest.suggested === category && (
                  <span className="ml-auto font-data text-[10px] text-brand">✓ matches</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-md border px-2.5 py-1 text-[12px] capitalize transition-colors ${
                    category === c
                      ? "border-brand bg-brand/[0.08] text-brand"
                      : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Where? (a point inside HSR Layout, Ward 174)">
            <div className="grid grid-cols-2 gap-2">
              <Coord label="Latitude" value={lat} onChange={setLat} step={0.0005} />
              <Coord label="Longitude" value={lng} onChange={setLng} step={0.0005} />
            </div>
            <span className="mt-1 block text-[11px] text-ink-faint">
              Defaults to the ward centre — nudge to the spot. (Must be inside 12.90–12.925 N,
              77.635–77.655 E.)
            </span>
          </Field>

          <Field label="Photo (optional — Gemini Vision will read it)">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-[12px] text-ink-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:text-ink-muted hover:file:border-brand"
            />
            {photo && (
              <span className="mt-1 block font-data text-[11px] text-ink-faint">
                {photo.name} · {(photo.size / 1024).toFixed(0)} KB
              </span>
            )}
          </Field>

          <button
            type="button"
            disabled={!canRun}
            onClick={run}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-[14px] font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconSubmit size={16} />
            {status.kind === "running" ? "Running the pipeline…" : "Run the pipeline"}
          </button>
          {(text.length > 0 || photo || status.kind === "done") && (
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setStatus({ kind: "idle" });
              }}
              className="mt-2 w-full rounded-lg border border-line py-1.5 text-[12px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink-muted"
            >
              Clear form
            </button>
          )}
        </section>

        {/* ── The result ── */}
        <section className="animate-rise" style={{ animationDelay: "80ms" }}>
          {status.kind === "idle" && <IdlePanel />}
          {status.kind === "running" && <RunningPanel />}
          {status.kind === "quarantined" && <QuarantinePanel reason={status.reason} />}
          {status.kind === "error" && <ErrorPanel message={status.message} />}
          {status.kind === "done" && (
            <ResultPanel result={status.result} onOpen={() => onSelectIssue(status.result.issue)} />
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="label mb-2">{label}</div>
      {children}
    </div>
  );
}

function Coord({
  label,
  value,
  onChange,
  step,
}: { label: string; value: number; onChange: (n: number) => void; step: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-ink-faint">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 font-data text-[12px] text-ink outline-none focus:border-brand"
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}

function IdlePanel() {
  return (
    <Shell>
      <div className="flex h-[360px] flex-col items-center justify-center text-center">
        <IconSubmit size={32} className="text-line-strong" />
        <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-faint">
          Fill the form and run the pipeline. The live trace and the resulting issue will appear
          here — each step labelled <span className="text-brand">live</span> (a real Gemini call) or
          computed.
        </p>
      </div>
    </Shell>
  );
}

function RunningPanel() {
  return (
    <Shell>
      <div className="flex h-[360px] flex-col items-center justify-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand" />
        <span className="font-data text-xs text-ink-faint">
          Reading, scoring, clustering, routing…
        </span>
      </div>
    </Shell>
  );
}

function QuarantinePanel({ reason }: { reason: string }) {
  return (
    <Shell>
      <div className="rounded-lg border border-critical/50 bg-critical/[0.06] p-4">
        <div className="label flex items-center gap-1.5 text-critical">
          <IconAlert size={14} /> Prompt-injection blocked
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">
          COMMONS flagged this submission as an attempt to manipulate the agents and{" "}
          <span className="font-medium">quarantined</span> it — no issue was generated from it.
        </p>
        <p className="mt-2 rounded-md bg-surface px-3 py-2 font-data text-[11px] leading-relaxed text-ink-muted">
          {reason}
        </p>
        <p className="mt-2 text-[11px] text-ink-faint">
          This is the security filter (C2) working — citizen text is treated as data to analyse,
          never as instructions to obey.
        </p>
      </div>
    </Shell>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Shell>
      <div className="flex h-[200px] items-center justify-center px-6 text-center">
        <p className="text-[13px] leading-relaxed text-ink-muted">{message}</p>
      </div>
    </Shell>
  );
}

const QUADRANT_COLOR: Record<string, string> = {
  critical: "#ff5c5c",
  hidden_crisis: "#f5a623",
  noise: "#6b7c93",
  monitor: "#3ea6ff",
};
const QUADRANT_LABEL: Record<string, string> = {
  critical: "Critical Priority",
  hidden_crisis: "Hidden Crisis",
  noise: "Noise",
  monitor: "Monitor",
};

function ResultPanel({ result, onOpen }: { result: SubmitResult; onOpen: () => void }) {
  const { issue, trace, anyLive } = result;
  const color = QUADRANT_COLOR[issue.quadrant];
  return (
    <div className="space-y-4">
      {/* The live trace */}
      <Shell>
        <div className="label mb-3 flex items-center justify-between">
          <span>The pipeline just ran</span>
          <span
            className={`rounded-md px-2 py-0.5 font-data text-[10px] ${
              anyLive ? "bg-brand/15 text-brand" : "bg-surface-overlay text-ink-faint"
            }`}
          >
            {anyLive ? "live Gemini calls" : "deterministic fallback"}
          </span>
        </div>
        <ol className="space-y-2">
          {trace.map((s: LiveStep, n: number) => (
            <li key={`${s.agent}-${n}`} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-data text-[10px] ${
                  s.live ? "bg-brand/15 text-brand" : "bg-surface-overlay text-ink-faint"
                }`}
              >
                {n + 1}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
                  {s.label}
                  {s.live && <span className="font-data text-[9px] text-brand">LIVE</span>}
                </div>
                <p className="text-[12px] leading-relaxed text-ink-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Shell>

      {/* The born issue */}
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <Shell>
          <div className="label mb-2" style={{ color }}>
            {QUADRANT_LABEL[issue.quadrant]} · your issue
          </div>
          <div className="text-[14px] font-medium text-ink">{issue.title}</div>
          <div className="mt-2 flex gap-4 font-data text-[12px] text-ink-muted">
            <span>
              impact <span className="text-ink">{issue.impactScore}</span>
            </span>
            <span>
              attention <span className="text-ink">{issue.attentionScore.toFixed(2)}</span>
            </span>
            <span>
              cell <span className="text-ink">{issue.plusCellId}</span>
            </span>
          </div>
          <div className="mt-2 text-[12px] text-brand">Open the full breakdown →</div>
        </Shell>
      </button>
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        Saved — find it in the Matrix and track its lifecycle anytime this session.
      </p>
    </div>
  );
}
