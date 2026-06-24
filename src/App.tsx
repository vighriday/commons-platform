import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Activity } from "lucide-react";
import { api } from "./lib/api.ts";
import { Quadrant } from "./components/Quadrant.tsx";
import { CivicPulse } from "./components/CivicPulse.tsx";
import { IssueDrawer } from "./components/IssueDrawer.tsx";
import { SeedBanner } from "./components/SeedBanner.tsx";

const WARD = "blr-174-hsr";

function Rail() {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-6 border-r border-line bg-surface py-4">
      <a href="/" aria-label="COMMONS home">
        <img src="/logo.svg" width={28} height={28} alt="COMMONS" />
      </a>
      <div className="flex flex-col gap-4 text-ink-faint">
        <button type="button" aria-label="Dashboard" className="text-brand">
          <LayoutGrid size={20} />
        </button>
        <button type="button" aria-label="Pulse" className="hover:text-ink">
          <Activity size={20} />
        </button>
      </div>
    </nav>
  );
}

function ContextBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[15px] font-semibold tracking-tight text-ink">COMMONS</span>
        <span className="label hidden sm:inline">operating system for community attention</span>
      </div>
      <div className="ml-auto">
        <SeedBanner />
      </div>
    </header>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const issuesQ = useQuery({ queryKey: ["issues"], queryFn: api.issues });
  const hoodQ = useQuery({ queryKey: ["neighborhood", WARD], queryFn: () => api.neighborhood(WARD) });

  return (
    <div className="flex h-full bg-surface text-ink">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <ContextBar />
        <main className="flex-1 overflow-auto px-6 py-6">
          <div className="mb-6">
            <p className="label">HSR Layout · BBMP Ward 174</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
              What should this community pay attention to?
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Communities don't fail from under-reporting — they fail from fragmented attention.
              COMMONS finds the problems hidden between the reports.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {issuesQ.data ? (
                <Quadrant
                  issues={issuesQ.data.issues}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <Skeleton label="Loading the Attention × Impact map…" />
              )}
            </div>
            <div className="lg:col-span-2">
              {hoodQ.data ? (
                <CivicPulse pulse={hoodQ.data.civicPulse} twin={hoodQ.data.twin} />
              ) : (
                <Skeleton label="Loading the Civic Pulse…" />
              )}
            </div>
          </div>
        </main>
      </div>

      {selectedId && <IssueDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-line bg-surface-raised">
      <span className="font-data text-xs text-ink-faint">{label}</span>
    </div>
  );
}
