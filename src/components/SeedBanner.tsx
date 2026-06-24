// Honest disclosure banner — always visible. The corpus is simulated; the
// grounding data (Open Buildings, Data Commons, Plus Codes) is real. The amber
// dot ties it to the Hidden-Crisis theme and breathes slowly, the one signal
// motion in the chrome.
export function SeedBanner() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface-overlay py-1 pl-2.5 pr-3">
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-hidden"
          style={{ animation: "hidden-breath 2.8s var(--ease-out) infinite" }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-hidden" />
      </span>
      <span className="font-data text-[11px] text-ink-muted">
        Simulated 18-month history · grounding data is real
      </span>
    </div>
  );
}
