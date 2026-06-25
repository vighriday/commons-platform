import type { Issue } from "@shared/types.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useState } from "react";
import { AgentTrace } from "./components/AgentTrace.tsx";
import { CivicPulse } from "./components/CivicPulse.tsx";
import { IssueDrawer } from "./components/IssueDrawer.tsx";
import { Quadrant } from "./components/Quadrant.tsx";
import { SeedBanner } from "./components/SeedBanner.tsx";
import { SubmitView } from "./components/SubmitView.tsx";
import { IconClock, IconLayers, IconMatrix, IconSubmit, IconTrace } from "./components/icons.tsx";
import { api } from "./lib/api.ts";
import { useTwinStore } from "./lib/twinStore.ts";

// The Twin (deck.gl) and Time Machine (maplibre) are heavy map deps — lazy-load
// them so the Matrix/Trace landing views ship a small first paint and only pull
// the map bundle when the user opens those views.
const DigitalTwin = lazy(() =>
  import("./components/twin/DigitalTwin.tsx").then((m) => ({ default: m.DigitalTwin })),
);
const TimeMachine = lazy(() =>
  import("./components/twin/TimeMachine.tsx").then((m) => ({ default: m.TimeMachine })),
);

const WARD = "blr-174-hsr";

// ── Left rail ── logo + primary nav, icon over a tracked label. The active item
// carries the brand; the rest sit quiet until hovered. All four views switch the
// main canvas; the store owns the active view (so a Matrix click can drive Twin).
function Rail() {
  const view = useTwinStore((s) => s.view);
  const setView = useTwinStore((s) => s.setView);
  return (
    <nav className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-4">
      <a href="/" aria-label="COMMONS home" className="mb-4">
        <img src="/logo.svg" width={30} height={30} alt="COMMONS" />
      </a>
      <RailItem
        icon={<IconMatrix size={20} />}
        label="Matrix"
        active={view === "matrix"}
        onClick={() => setView("matrix")}
      />
      <RailItem
        icon={<IconTrace size={20} />}
        label="Trace"
        active={view === "trace"}
        onClick={() => setView("trace")}
      />
      <RailItem
        icon={<IconLayers size={20} />}
        label="Twin"
        active={view === "twin"}
        onClick={() => setView("twin")}
      />
      <RailItem
        icon={<IconClock size={20} />}
        label="Time"
        active={view === "time"}
        onClick={() => setView("time")}
      />
      <RailItem
        icon={<IconSubmit size={20} />}
        label="Submit"
        active={view === "submit"}
        onClick={() => setView("submit")}
      />
    </nav>
  );
}

function RailItem({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const base =
    "group relative flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-colors duration-150";
  const state = active
    ? "text-brand"
    : disabled
      ? "text-ink-faint/45"
      : "text-ink-faint hover:text-ink";
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${state} ${disabled ? "cursor-default" : ""}`}
    >
      {/* Active indicator — a hairline bar on the rail edge, not a filled pill. */}
      {active && <span className="absolute left-0 top-1.5 h-9 w-0.5 rounded-r bg-brand" />}
      {icon}
      <span
        className="text-[10px] font-medium uppercase tracking-[0.08em]"
        style={{ fontFeatureSettings: '"cv11"' }}
      >
        {label}
      </span>
    </button>
  );
}

// ── Top context bar ── wordmark + ward identity on the left, the honest
// synthetic-data banner on the right. A single hairline separates it from the
// canvas; nothing competes with the data below.
function ContextBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-semibold tracking-tight text-ink">COMMONS</span>
        <span className="hidden h-3.5 w-px bg-line sm:inline-block" />
        <span className="label hidden sm:inline">Community Attention OS</span>
      </div>
      <div className="ml-auto">
        <SeedBanner />
      </div>
    </header>
  );
}

// The ward label with a hover card that spells out exactly what HSR Layout and
// BBMP Ward 174 are — real figures (2011 Census), so a judge unfamiliar with
// Bengaluru gets full context without leaving the page.
function PlaceLabel() {
  return (
    <span className="group relative inline-flex items-center gap-1.5">
      <span className="label">HSR Layout · BBMP Ward 174</span>
      <button
        type="button"
        aria-label="What is BBMP Ward 174?"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line-strong text-[9px] font-medium text-ink-faint transition-colors hover:border-brand hover:text-brand"
      >
        ?
      </button>
      {/* Hover/focus card — CSS-only, compact so it never clips the canvas below. */}
      <span
        role="tooltip"
        className="invisible absolute left-0 top-6 z-30 w-[18rem] origin-top-left scale-95 rounded-lg border border-line-strong bg-surface-overlay p-3 opacity-0 shadow-[var(--shadow-overlay)] transition-all duration-150 group-hover:visible group-hover:scale-100 group-hover:opacity-100 group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100"
      >
        <span className="block text-[13px] font-medium text-ink">HSR Layout, Bengaluru, India</span>
        <span className="mt-1 block text-[12px] leading-snug text-ink-muted">
          South-east Bengaluru · <span className="font-data text-ink">63,033</span> residents ·{" "}
          <span className="font-data text-ink">7.1 km²</span> (2011 Census).
        </span>
        <span className="mt-2 block border-t border-line pt-2 text-[12px] leading-snug text-ink-muted">
          <span className="font-medium text-ink">BBMP</span> = Bengaluru's city corporation.{" "}
          <span className="font-medium text-ink">Ward 174</span> is HSR Layout's elected civic unit
          — 1 of 243, the smallest tier of local government.
        </span>
      </span>
    </span>
  );
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const view = useTwinStore((s) => s.view);
  const queryClient = useQueryClient();

  const issuesQ = useQuery({ queryKey: ["issues"], queryFn: api.issues });
  const hoodQ = useQuery({
    queryKey: ["neighborhood", WARD],
    queryFn: () => api.neighborhood(WARD),
  });

  // A live-submitted issue isn't on the server's /api/issues/:id route, so prime
  // the query cache with it before opening the drawer (which reads that cache).
  function openLiveIssue(issue: Issue) {
    queryClient.setQueryData(["issue", issue.issueId], issue);
    setSelectedId(issue.issueId);
  }

  // Twin + Time are full-bleed map surfaces; Matrix + Trace sit in the titled
  // reading column. The frame (rail + context bar) is shared.
  const isMap = view === "twin" || view === "time";

  return (
    <div className="flex h-full bg-surface text-ink">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <ContextBar />
        <main className="min-h-0 flex-1 overflow-auto">
          {view === "submit" ? (
            <SubmitView onSelectIssue={openLiveIssue} />
          ) : isMap ? (
            <div className="h-full">
              <Suspense fallback={<MapLoading />}>
                {view === "twin" ? (
                  <DigitalTwin
                    ward={WARD}
                    twin={hoodQ.data?.twin ?? null}
                    issues={issuesQ.data?.issues ?? []}
                    onSelect={setSelectedId}
                  />
                ) : (
                  <TimeMachine ward={WARD} issues={issuesQ.data?.issues ?? []} />
                )}
              </Suspense>
            </div>
          ) : (
            <div className="mx-auto max-w-[1400px] px-7 py-7">
              {/* Title block — a real display-tier headline, generous air below. */}
              <header className="mb-7 animate-rise" style={{ animationDelay: "40ms" }}>
                <PlaceLabel />
                <h1
                  className="mt-2 max-w-3xl font-semibold text-ink"
                  style={{
                    fontSize: "var(--text-display)",
                    lineHeight: "var(--text-display--line-height)",
                    letterSpacing: "var(--text-display--letter-spacing)",
                  }}
                >
                  What should this community pay attention to?
                </h1>
                {/* Plain-language place context — a judge has no reason to know what
                    "HSR Layout" or "BBMP Ward 174" is, so we say it outright. */}
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-faint">
                  A dense residential neighbourhood of{" "}
                  <span className="font-data text-ink-muted">63,033</span> people in{" "}
                  <span className="text-ink-muted">Bengaluru, India</span> — its civic affairs are
                  run by BBMP Ward 174, the smallest unit of the city government.
                </p>
                <p className="mt-3 max-w-2xl text-ink-muted">
                  Communities don't fail from under-reporting — they fail from fragmented attention.
                  COMMONS finds the problems hidden between the reports.
                </p>
              </header>

              {view === "matrix" ? (
                /* Canvas — the quadrant leads (3/5), the Civic Pulse reads alongside (2/5).
                   Not three equal cards; an intentional asymmetric split. */
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                  <div className="animate-rise lg:col-span-3" style={{ animationDelay: "120ms" }}>
                    {issuesQ.data ? (
                      <Quadrant
                        issues={issuesQ.data.issues}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                      />
                    ) : (
                      <QuadrantSkeleton error={issuesQ.isError} />
                    )}
                  </div>
                  <div className="animate-rise lg:col-span-2" style={{ animationDelay: "200ms" }}>
                    {hoodQ.data ? (
                      <CivicPulse pulse={hoodQ.data.civicPulse} twin={hoodQ.data.twin} />
                    ) : (
                      <PanelSkeleton error={hoodQ.isError} label="Civic Pulse" />
                    )}
                  </div>
                </div>
              ) : (
                /* Trace — the 7-agent pipeline, the Agentic-Depth artifact. */
                <div className="animate-rise" style={{ animationDelay: "120ms" }}>
                  {issuesQ.data ? (
                    <AgentTrace issues={issuesQ.data.issues} onSelect={setSelectedId} />
                  ) : (
                    <PanelSkeleton error={issuesQ.isError} label="Agent Trace" />
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {selectedId && <IssueDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ── Loading / error states ── quiet line illustrations, never a bare spinner. ──

function QuadrantSkeleton({ error }: { error?: boolean }) {
  return (
    <div className="flex h-[520px] flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]">
      {/* A faint quartered-field glyph that previews the real matrix. */}
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" className="text-line-strong">
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="2.5"
          stroke="currentColor"
          strokeWidth={1.5}
        />
        <path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth={1.5} />
        <circle cx="8" cy="16" r="1.5" className="text-hidden" fill="currentColor" stroke="none">
          {!error && (
            <animate
              attributeName="opacity"
              values="0.4;1;0.4"
              dur="1.8s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      </svg>
      <span className="font-data text-xs text-ink-faint">
        {error
          ? "Could not load the Attention × Impact map."
          : "Building the Attention × Impact map…"}
      </span>
    </div>
  );
}

function PanelSkeleton({ error, label }: { error?: boolean; label: string }) {
  return (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-card)]">
      <span className="font-data text-xs text-ink-faint">
        {error ? `Could not load the ${label}.` : `Loading the ${label}…`}
      </span>
    </div>
  );
}

// Shown while the lazy-loaded map bundle (deck.gl / maplibre) downloads.
function MapLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <span className="font-data text-xs text-ink-faint">Loading the map…</span>
    </div>
  );
}
