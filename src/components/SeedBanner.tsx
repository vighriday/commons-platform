// Honest disclosure banner — always visible. The corpus is simulated; the
// grounding data (Open Buildings, Data Commons, Plus Codes) is real.
export function SeedBanner() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface-overlay px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-hidden" />
      <span className="font-data text-[11px] text-ink-muted">
        Simulated 18-month history for HSR Layout (BBMP Ward 174) — grounding data is real
      </span>
    </div>
  );
}
