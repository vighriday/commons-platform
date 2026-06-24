// COMMONS — the fixed, published Severity table.
//
// Severity is NOT a free LLM guess. Gemini classifies a report into ONE ROW of
// this table per category; `severityNorm = row / 5`. Because the table is fixed
// and inspectable, every Impact score is auditable. (seed-design.md §4.)
import type { Category } from "../shared/types.ts";

export interface SeverityRow {
  row: number; // 1..5
  label: string;
}

export const SEVERITY_TABLE: Record<Category, [string, string, string, string, string]> = {
  water: [
    "cosmetic drip",
    "low pressure / intermittent",
    "sustained leak, visible water",
    "rusty / contaminated supply",
    "main rupture / supply loss to block",
  ],
  drainage: [
    "minor pooling",
    "slow drain",
    "partial blockage, smell",
    "overflow onto road / silted choke",
    "sewage flooding homes",
  ],
  roads: [
    "hairline crack",
    "minor pothole",
    "multiple / large potholes",
    "road depression / subsidence",
    "collapse / sinkhole",
  ],
  waste: [
    "litter",
    "uncollected bin 1–2 days",
    "pile-up / overflow",
    "drain-blocking dump",
    "hazardous / medical waste",
  ],
  streetlights: [
    "flicker",
    "single light out",
    "outage on arterial / transit",
    "dark stretch, pedestrian zone",
    "dark accident-prone junction",
  ],
  structural: [
    "paint / plaster damage",
    "surface crack",
    "spreading crack",
    "load-bearing crack",
    "imminent collapse / tilt",
  ],
  parks: [
    "overgrowth",
    "dead branches",
    "leaning tree",
    "large tree blocking path",
    "tree-fall risk over road",
  ],
  traffic: [
    "faded marking",
    "missing sign",
    "broken signal",
    "unsafe junction config",
    "blackspot / repeated accidents",
  ],
  other: [
    "minor nuisance",
    "low concern",
    "moderate concern",
    "serious concern",
    "critical concern",
  ],
};

/** Look up the descriptor for a (category, row) pair. Clamps row to 1..5. */
export function severityLabel(category: Category, row: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(row)));
  return SEVERITY_TABLE[category][clamped - 1];
}

/** Normalize a severity row (1..5) to 0..1. */
export function severityNorm(row: number): number {
  return Math.min(5, Math.max(1, Math.round(row))) / 5;
}
