// COMMONS — the Step Inspector.
//
// Click any agent step in the trace and this slides in from the right, showing
// that single agent's microprocess in plain language AND in raw data, side by
// side: GOT → DID → SAID → TRUST on top, then the exact input it received and
// the exact output it produced (the evidence rows). This is the "see the
// slightest of the information" surface — nothing is hidden behind a tooltip.

import type { AgentStep } from "@shared/types.ts";
import { AGENT_META, MODEL_PLAIN, explainStep } from "../lib/explain.ts";
import { IconReversal } from "./icons.tsx";

export function StepInspector({
  step,
  issueTitle,
  stepIndex,
  onClose,
}: {
  step: AgentStep;
  issueTitle: string;
  stepIndex: number;
  onClose: () => void;
}) {
  const meta = AGENT_META[step.agent];
  const x = explainStep(step);
  const overruled = step.status === "overruled";

  return (
    <div role="dialog" aria-modal="true" aria-label={`${meta.label} — what it did`}>
      <button
        type="button"
        aria-label="Close inspector"
        className="fixed inset-0 z-40 animate-fade-in bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md animate-slide-in-right flex-col border-l border-line bg-surface-raised shadow-[var(--shadow-overlay)]">
        {/* Header — which agent, on which problem, in which order. */}
        <header className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="label flex items-center gap-1.5">
                Step {stepIndex} of 7
                {overruled && (
                  <span className="flex items-center gap-1 text-hidden">
                    <IconReversal size={12} /> overruled the crowd
                  </span>
                )}
              </div>
              <h2
                className="mt-1 font-semibold text-ink"
                style={{ fontSize: "var(--text-h2)", lineHeight: "var(--text-h2--line-height)" }}
              >
                {meta.label} agent
              </h2>
              <p className="mt-1 truncate text-[12px] text-ink-faint">on “{issueTitle}”</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-overlay hover:text-ink"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{meta.job}</p>
        </header>

        <div className="flex-1 space-y-5 overflow-auto px-5 py-5">
          {/* The four plain-language sentences — the core. */}
          <section className="space-y-2.5">
            <PlainRow tone="got" label="What it received" body={x.got} />
            <PlainRow tone="did" label="What it did" body={x.did} />
            <PlainRow tone="said" label="What it concluded" body={x.said} />
            <PlainRow tone="trust" label="Why we trust it" body={x.trust} />
          </section>

          {/* The model + cost — honest about spend. */}
          <section className="rounded-lg border border-line bg-surface px-3.5 py-3">
            <div className="label mb-1.5">Under the hood</div>
            <div className="text-[12px] leading-relaxed text-ink-muted">
              Ran on {MODEL_PLAIN[step.model] ?? step.model}.
            </div>
            <div className="mt-1.5 font-data text-[11px] text-ink-faint">
              {step.cached
                ? "Served from a frozen run — 0 live API calls, 0 quota spent."
                : `${step.callCount} live call${step.callCount === 1 ? "" : "s"} · ${step.ms}ms`}
            </div>
          </section>

          {/* The raw input — exactly what the agent was handed. */}
          <RawBlock label="The exact input it received" value={step.in} />

          {/* The raw evidence rows — the receipts behind the conclusion. */}
          {step.out && step.out.evidence.length > 0 && (
            <section>
              <div className="label mb-2">The receipts behind it</div>
              <ul className="space-y-2">
                {step.out.evidence.map((e, n) => (
                  <li
                    key={`${e.reportId}-${e.field}-${n}`}
                    className="rounded-lg border border-line bg-surface px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 font-data text-[10px] text-ink-faint">
                      <span>{e.reportId}</span>
                      <span className="text-line-strong">·</span>
                      <span>{e.field}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{e.value}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

// One plain-language row, colour-keyed so the four stages read as a sequence.
function PlainRow({
  tone,
  label,
  body,
}: {
  tone: "got" | "did" | "said" | "trust";
  label: string;
  body: string;
}) {
  const bar =
    tone === "got"
      ? "bg-ink-faint"
      : tone === "did"
        ? "bg-brand"
        : tone === "said"
          ? "bg-hidden"
          : "bg-critical/70";
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
      <span className={`mt-0.5 w-0.5 shrink-0 rounded-full ${bar}`} />
      <div className="min-w-0">
        <div className="label">{label}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink">{body}</p>
      </div>
    </div>
  );
}

// The raw JSON the agent was handed — collapsed by default, for the curious.
function RawBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="label cursor-pointer select-none px-3.5 py-2.5 text-ink-faint hover:text-ink">
        {label}
      </summary>
      <pre className="overflow-x-auto border-t border-line px-3.5 py-3 font-data text-[11px] leading-relaxed text-ink-muted">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
