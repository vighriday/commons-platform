import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, ReferenceLine, ReferenceArea,
  ResponsiveContainer, Cell, Tooltip,
} from "recharts";
import type { Issue, Quadrant as QuadrantKey } from "@shared/types.ts";

// The Contradiction Engine — Attention (x, 0–1) vs Impact (y, 0–100).
// The high-impact / low-attention cell glows amber: the Hidden Crises. This is
// the screen that shows, at a glance, where the crowd is wrong.

const QUADRANT_COLOR: Record<QuadrantKey, string> = {
  critical: "#ff5c5c",
  hidden_crisis: "#f5a623",
  noise: "#6b7c93",
  monitor: "#3ea6ff",
};

interface Props {
  issues: Issue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface Point {
  x: number;
  y: number;
  z: number;
  issue: Issue;
}

export function Quadrant({ issues, selectedId, onSelect }: Props) {
  const points: Point[] = issues.map((i) => ({
    x: i.attentionScore,
    y: i.impactScore,
    z: 120 + i.impactScore * 4,
    issue: i,
  }));

  return (
    <div className="relative rounded-2xl border border-line bg-surface-raised p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="label">Contradiction Engine</div>
          <h2 className="mt-1 text-base font-medium text-ink">Attention vs Impact</h2>
        </div>
        <p className="max-w-[15rem] text-right text-xs leading-relaxed text-ink-muted">
          The loudest issue is rarely the most dangerous. Amber = high impact, low attention.
        </p>
      </div>

      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 36, left: 8 }}>
            {/* Quadrant tints — the Hidden-Crisis cell is emphasised. */}
            <ReferenceArea x1={0} x2={0.5} y1={50} y2={100} fill="#f5a623" fillOpacity={0.07} />
            <ReferenceArea x1={0.5} x2={1} y1={50} y2={100} fill="#ff5c5c" fillOpacity={0.05} />
            <ReferenceArea x1={0.5} x2={1} y1={0} y2={50} fill="#6b7c93" fillOpacity={0.04} />
            <ReferenceArea x1={0} x2={0.5} y1={0} y2={50} fill="#3ea6ff" fillOpacity={0.03} />

            <ReferenceLine x={0.5} stroke="#1f2a37" strokeWidth={1} />
            <ReferenceLine y={50} stroke="#1f2a37" strokeWidth={1} />

            <XAxis
              type="number" dataKey="x" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fill: "#5d7184", fontSize: 11 }} stroke="#1f2a37"
              label={{ value: "COMMUNITY ATTENTION →", position: "bottom", offset: 14, fill: "#5d7184", fontSize: 11, letterSpacing: "0.1em" }}
            />
            <YAxis
              type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: "#5d7184", fontSize: 11 }} stroke="#1f2a37"
              label={{ value: "IMPACT →", angle: -90, position: "left", offset: -4, fill: "#5d7184", fontSize: 11, letterSpacing: "0.1em" }}
            />
            <ZAxis type="number" dataKey="z" range={[120, 520]} />
            <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "#5d7184" }} content={<PointTip />} />

            <Scatter data={points} onClick={(p: { issue?: Issue }) => p.issue && onSelect(p.issue.issueId)}>
              {points.map((p) => {
                const isSel = p.issue.issueId === selectedId;
                const color = QUADRANT_COLOR[p.issue.quadrant];
                return (
                  <Cell
                    key={p.issue.issueId}
                    fill={color}
                    fillOpacity={isSel ? 1 : 0.85}
                    stroke={isSel ? "#e6edf3" : color}
                    strokeWidth={isSel ? 2 : 0}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Quadrant legend */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        <LegendItem color="#ff5c5c" label="Critical" />
        <LegendItem color="#f5a623" label="Hidden Crisis" />
        <LegendItem color="#6b7c93" label="Noise" />
        <LegendItem color="#3ea6ff" label="Monitor" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-ink-faint">{label}</span>
    </div>
  );
}

function PointTip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const i = payload[0].payload.issue;
  return (
    <div className="max-w-[18rem] rounded-lg border border-line bg-surface-overlay px-3 py-2 shadow-card">
      <div className="text-xs font-medium text-ink">{i.title}</div>
      <div className="mt-1 flex gap-3 font-data text-[11px] text-ink-muted">
        <span>impact {i.impactScore}</span>
        <span>attention {i.attentionScore.toFixed(2)}</span>
      </div>
      {i.reversal?.overruledAttention && (
        <div className="mt-1 text-[11px] text-hidden">⟲ overrules attention</div>
      )}
    </div>
  );
}
