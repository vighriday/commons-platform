import { useQuery } from "@tanstack/react-query";

// ── Phase 0 shell ──────────────────────────────────────────────────────────────
// The enterprise frame (rail · context bar · canvas) and a live System Status
// panel that exercises the three de-risk endpoints. This is intentionally a
// real, working surface — not a placeholder — so "it deploys and the full stack
// is alive" is provable on screen.

type Health = { ok: boolean; service: string; time: string };
type Smoke = {
  ok: boolean;
  env: string;
  geminiConfigured: boolean;
  models: Record<string, string>;
};
type Ping = { ok: boolean; model?: string; text?: string; error?: string };

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok && res.status >= 500) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

function StatusDot({ state }: { state: "ok" | "warn" | "down" | "pending" }) {
  const color =
    state === "ok"
      ? "#3ddc97"
      : state === "warn"
        ? "#f5a623"
        : state === "down"
          ? "#ff5c5c"
          : "#5d7184";
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill={color} />
      {state === "ok" && (
        <circle
          cx="5"
          cy="5"
          r="4.5"
          fill="none"
          stroke={color}
          strokeOpacity="0.35"
          strokeWidth="3"
        />
      )}
    </svg>
  );
}

function Row({
  label,
  state,
  detail,
}: {
  label: string;
  state: "ok" | "warn" | "down" | "pending";
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-line last:border-0">
      <div className="flex items-center gap-3">
        <StatusDot state={state} />
        <span className="text-sm text-ink">{label}</span>
      </div>
      <span className="font-data text-[13px] text-ink-muted text-right truncate max-w-[55%]">
        {detail}
      </span>
    </div>
  );
}

function SystemStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: () => getJSON<Health>("/api/health") });
  const smoke = useQuery({ queryKey: ["smoke"], queryFn: () => getJSON<Smoke>("/api/_smoke") });
  const ping = useQuery({ queryKey: ["ping"], queryFn: () => getJSON<Ping>("/api/gemini-ping") });

  const healthState = health.isPending ? "pending" : health.data?.ok ? "ok" : "down";
  const smokeState = smoke.isPending ? "pending" : smoke.data?.ok ? "ok" : "down";
  const pingState = ping.isPending
    ? "pending"
    : ping.data?.ok
      ? "ok"
      : ping.data?.error === "GEMINI_NOT_CONFIGURED"
        ? "warn"
        : "down";

  return (
    <section className="rounded-2xl bg-surface-raised border border-line shadow-card overflow-hidden">
      <header className="px-5 py-4 border-b border-line flex items-center justify-between">
        <div>
          <div className="label">System Status</div>
          <h2 className="text-base font-medium text-ink mt-1">Deployment health</h2>
        </div>
        <span className="font-data text-[11px] text-ink-faint">phase 0 · de-risk</span>
      </header>
      <div className="px-5 py-1">
        <Row
          label="Web server"
          state={healthState}
          detail={
            health.data
              ? `${health.data.service} · live`
              : health.isError
                ? "unreachable"
                : "checking…"
          }
        />
        <Row
          label="Server config"
          state={smokeState}
          detail={smoke.data ? `${smoke.data.env} · models loaded` : "checking…"}
        />
        <Row
          label="Gemini API"
          state={pingState}
          detail={
            ping.data?.ok
              ? `${ping.data.model} → “${ping.data.text}”`
              : ping.data?.error === "GEMINI_NOT_CONFIGURED"
                ? "key not configured"
                : ping.isError
                  ? "call failed"
                  : "checking…"
          }
        />
      </div>
    </section>
  );
}

function Rail() {
  return (
    <nav className="w-14 shrink-0 border-r border-line flex flex-col items-center py-4 gap-6 bg-surface">
      <a href="/" aria-label="COMMONS home" className="block">
        <img src="/logo.svg" width={28} height={28} alt="COMMONS" />
      </a>
    </nav>
  );
}

function ContextBar() {
  return (
    <header className="h-14 shrink-0 border-b border-line flex items-center px-6 gap-4 bg-surface">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[15px] font-semibold tracking-tight text-ink">COMMONS</span>
        <span className="label">operating system for community attention</span>
      </div>
      <div className="ml-auto flex items-center gap-2 rounded-full border border-line px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-hidden" />
        <span className="font-data text-[11px] text-ink-muted">
          simulated history — disclosed-synthetic demo
        </span>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="h-full flex bg-surface text-ink">
      <Rail />
      <div className="flex-1 flex flex-col min-w-0">
        <ContextBar />
        <main className="flex-1 overflow-auto px-6 py-8">
          <div className="max-w-2xl">
            <p className="label">Phase 0 · foundation</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              The system is live.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              This is the deployed foundation of COMMONS. The panel below confirms the web server,
              server configuration, and the server-side Gemini connection are all working end to
              end. The community-intelligence features are built on top of this, step by step.
            </p>
            <div className="mt-8">
              <SystemStatus />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
