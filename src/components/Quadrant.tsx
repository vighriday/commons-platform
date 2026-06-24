import { useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, ReferenceLine, ReferenceArea,
  ResponsiveContainer, Cell, Tooltip,
} from "recharts";
import type { Issue, Quadrant as QuadrantKey } from "@shared/types.ts";
import { IconReversal } from "./icons.tsx";

// The Contradiction Engine — Attention (x, 0–1) vs Impact (y, 0–100).
// The high-impact / low-attention cell glows amber: the Hidden Crises. This is
// the screen that shows, at a glance, where the crowd is wrong. Rendered as a
// precision instrument: tinted quadrants, mono axis numerals, a calm breath on
// the overlooked marker, and a data-table fallback so the numbers are auditable.

const QUADRANT_COLOR: Record<QuadrantKey, string> = {
  critical: "#ff5c5c",
  hidden_crisis: "#f5a623",
  noise: "#6b7c93",
  monitor: "#3ea6ff",
};

const QUADRANT_LABEL: Record<QuadrantKey, string> = {
  critical: "Critical",
  hidden_crisis: "Hidden Crisis",
  noise: "Noise",
  monitor: "Monitor",
};

const MONO = "var(--font-mono)";
const AXIS = "#5d7184";

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
  const [showTable, setShowTable] = useState(false);

  const points: Point[] = issues.map((i) => ({
    x: i.attentionScore,
    y: i.impactScore,
    z: 140 + i.impactScore * 4,
    issue: i,
  }));

  const ariaSummary = `Attention versus Impact scatter of ${issues.length} issues. ${
    issues.filter((i) => i.quadrant === "hidden_crisis").length
  } sit in the Hidden Crisis quadrant: high impact, low community attention.`;

  return (
    <section className="relative rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="label">Contradiction Engine</div>
          <h2
            className="mt-1 font-semibold text-ink"
            style={{
              fontSize: "var(--text-h2)",
              lineHeight: "var(--text-h2--line-height)",
              letterSpacing: "var(--text-h2--letter-spacing)",
            }}
          >
            Attention vs Impact
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="shrink-0 rounded-md border border-line px-2.5 py-1 font-data text-[11px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          {showTable ? "View chart" : "View data"}
        </button>
      </div>

      <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        The loudest issue is rarely the most dangerous. The amber quadrant holds the{" "}
        <span className="text-hidden">Hidden Crises</span> — high impact, low attention.
      </p>

      {showTable ? (
        <DataTable issues={issues} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <>
          <figure role="img" aria-label={ariaSummary} className="h-[440px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 22, bottom: 38, left: 6 }}>
                {/* Quadrant tints — the Hidden-Crisis cell is weighted to pull the eye. */}
                <ReferenceArea x1={0} x2={0.5} y1={50} y2={100} fill="#f5a623" fillOpacity={0.08} />
                <ReferenceArea x1={0.5} x2={1} y1={50} y2={100} fill="#ff5c5c" fillOpacity={0.05} />
                <ReferenceArea x1={0.5} x2={1} y1={0} y2={50} fill="#6b7c93" fillOpacity={0.035} />
                <ReferenceArea x1={0} x2={0.5} y1={0} y2={50} fill="#3ea6ff" fillOpacity={0.03} />

                {/* In-plot quadrant captions — quiet, tracked, sit in the corners. */}
                <ReferenceArea x1={0} x2={0.5} y1={50} y2={100} fill="none"
                  label={{ value: "HIDDEN CRISIS", position: "insideTopLeft", fill: "#f5a623", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", dx: 6, dy: 6 }} />
                <ReferenceArea x1={0.5} x2={1} y1={50} y2={100} fill="none"
                  label={{ value: "CRITICAL", position: "insideTopRight", fill: "#ff5c5c", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", dx: -6, dy: 6 }} />
                <ReferenceArea x1={0.5} x2={1} y1={0} y2={50} fill="none"
                  label={{ value: "NOISE", position: "insideBottomRight", fill: "#6b7c93", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", dx: -6, dy: -6 }} />
                <ReferenceArea x1={0} x2={0.5} y1={0} y2={50} fill="none"
                  label={{ value: "MONITOR", position: "insideBottomLeft", fill: "#3ea6ff", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", dx: 6, dy: -6 }} />

                <ReferenceLine x={0.5} stroke="#1f2a37" strokeWidth={1} />
                <ReferenceLine y={50} stroke="#1f2a37" strokeWidth={1} />

                <XAxis
                  type="number" dataKey="x" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={{ fill: AXIS, fontSize: 11, fontFamily: MONO }} stroke="#1f2a37" tickLine={false}
                  label={{ value: "COMMUNITY ATTENTION  →", position: "bottom", offset: 16, fill: AXIS, fontSize: 10.5, letterSpacing: "0.14em" }}
                />
                <YAxis
                  type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
                  tick={{ fill: AXIS, fontSize: 11, fontFamily: MONO }} stroke="#1f2a37" tickLine={false}
                  label={{ value: "IMPACT  →", angle: -90, position: "left", offset: -2, fill: AXIS, fontSize: 10.5, letterSpacing: "0.14em" }}
                />
                <ZAxis type="number" dataKey="z" range={[140, 560]} />
                <Tooltip cursor={{ stroke: "#3ddc97", strokeWidth: 1, strokeOpacity: 0.35 }} content={<PointTip />} />

                <Scatter data={points} isAnimationActive onClick={(p: { issue?: Issue }) => p.issue && onSelect(p.issue.issueId)}>
                  {points.map((p) => {
                    const isSel = p.issue.issueId === selectedId;
                    const isHidden = p.issue.quadrant === "hidden_crisis";
                    const color = QUADRANT_COLOR[p.issue.quadrant];
                    return (
                      <Cell
                        key={p.issue.issueId}
                        fill={color}
                        fillOpacity={isSel ? 1 : isHidden ? 0.95 : 0.82}
                        stroke={isSel ? "#e6edf3" : color}
                        strokeWidth={isSel ? 2 : isHidden ? 1.5 : 0}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </figure>

          {/* Legend — the four quadrant colours, each with its count. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
            {(Object.keys(QUADRANT_LABEL) as QuadrantKey[]).map((q) => (
              <LegendItem
                key={q}
                color={QUADRANT_COLOR[q]}
                label={QUADRANT_LABEL[q]}
                count={issues.filter((i) => i.quadrant === q).length}
                emphasised={q === "hidden_crisis"}
              />
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-ink-faint">
              <IconReversal size={13} className="text-hidden" />
              click a point for the audit
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function LegendItem({
  color, label, count, emphasised,
}: { color: string; label: string; count: number; emphasised?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: emphasised ? `0 0 0 3px ${color}22` : undefined }}
      />
      <span className={`text-[12px] ${emphasised ? "font-medium text-ink" : "text-ink-muted"}`}>
        {label}
      </span>
      <span className="font-data text-[11px] text-ink-faint">{count}</span>
    </div>
  );
}

function PointTip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const i = payload[0].payload.issue;
  return (
    <div className="max-w-[19rem] rounded-lg border border-line-strong bg-surface-overlay px-3.5 py-2.5 shadow-[var(--shadow-overlay)]">
      <div className="text-[13px] font-medium leading-snug text-ink">{i.title}</div>
      <div className="mt-2 flex gap-4 font-data text-[11px]">
        <span className="text-ink-muted">
          impact <span className="text-ink">{i.impactScore}</span>
        </span>
        <span className="text-ink-muted">
          attention <span className="text-ink">{i.attentionScore.toFixed(2)}</span>
        </span>
      </div>
      {i.reversal?.overruledAttention && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[11px] text-hidden">
          <IconReversal size={13} />
          <span>overrules community attention</span>
        </div>
      )}
    </div>
  );
}

// Accessible, auditable fallback — the same data as a sortable-feeling table.
// Doubles as the "show me the real numbers" view the design language calls for.
function DataTable({ issues, selectedId, onSelect }: Props) {
  const ranked = [...issues].sort((a, b) => b.impactScore - a.impactScore);
  return (
    <div className="h-[440px] overflow-auto rounded-lg border border-line">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-surface-overlay">
          <tr className="border-b border-line">
            {["Issue", "Impact", "Attention", "Quadrant"].map((h) => (
              <th key={h} className="label px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((i) => {
            const sel = i.issueId === selectedId;
            return (
              <tr
                key={i.issueId}
                onClick={() => onSelect(i.issueId)}
                className={`cursor-pointer border-b border-line/60 transition-colors hover:bg-surface-overlay/60 ${sel ? "bg-surface-overlay" : ""}`}
              >
                <td className="px-3 py-2.5 text-[13px] text-ink">{i.title}</td>
                <td className="px-3 py-2.5 font-data text-[13px] text-ink">{i.impactScore}</td>
                <td className="px-3 py-2.5 font-data text-[13px] text-ink-muted">{i.attentionScore.toFixed(2)}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: QUADRANT_COLOR[i.quadrant] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: QUADRANT_COLOR[i.quadrant] }} />
                    {QUADRANT_LABEL[i.quadrant]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
