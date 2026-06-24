// COMMONS — the auditable scoring math.
//
// Pure, deterministic functions shared by the spine derivation AND the real
// agent pipeline. Every number is reproducible from inputs — nothing is
// LLM-rated. (Formulas: seed-design.md §5 + audit B8/B10/B11/B12.)
import type { AdminLevel, Quadrant } from "./types.ts";

export const QUADRANT_THRESHOLDS = { attention: 0.5, impact: 50 } as const;

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// ── Impact = round(severityNorm × exposure × vulnerability × 100) ────────────────
export function computeImpact(severityNorm: number, exposure: number, vulnerability: number): number {
  return Math.round(clamp01(severityNorm) * clamp01(exposure) * clamp01(vulnerability) * 100);
}

// ── Attention = 0.5·alarm + 0.3·engagement + 0.2·recency ─────────────────────────
export interface AttentionInputs {
  alarmIntensityMean: number; // 0..1
  upvotes: number;
  replies: number;
  maxWardEngagement: number;
  recencyNorm: number; // 0..1 (1 = most recent)
}
export function computeAttention(i: AttentionInputs): number {
  const engagementNorm = i.maxWardEngagement > 0 ? (i.upvotes + 2 * i.replies) / i.maxWardEngagement : 0;
  return Math.round(clamp01(0.5 * i.alarmIntensityMean + 0.3 * clamp01(engagementNorm) + 0.2 * i.recencyNorm) * 100) / 100;
}

// ── Quadrant from (attention, impact) ────────────────────────────────────────────
export function computeQuadrant(attention: number, impact: number): Quadrant {
  const hiAtt = attention >= QUADRANT_THRESHOLDS.attention;
  const hiImp = impact >= QUADRANT_THRESHOLDS.impact;
  if (hiImp && hiAtt) return "critical";
  if (hiImp && !hiAtt) return "hidden_crisis";
  if (!hiImp && hiAtt) return "noise";
  return "monitor";
}

// ── Confidence (DERIVED, never LLM-rated) ────────────────────────────────────────
const ADMIN_SCORE: Record<AdminLevel, number> = { ward: 1.0, subdistrict: 0.8, district: 0.6, state: 0.4 };
export interface ConfidenceInputs {
  contributingCount: number;
  adminLevel: AdminLevel;
  meanPairwiseCosine: number | null; // null when single-source
}
export function deriveConfidence(i: ConfidenceInputs): { value: number; singleSource: boolean } {
  const sourceAgreement = Math.min(1, i.contributingCount / 4);
  const adminLevelScore = ADMIN_SCORE[i.adminLevel];
  const singleSource = i.contributingCount <= 1 || i.meanPairwiseCosine === null;
  const clusterTightness = singleSource ? 0.7 : clamp01(i.meanPairwiseCosine as number);
  const value = Math.round((0.4 * sourceAgreement + 0.25 * adminLevelScore + 0.35 * clusterTightness) * 100) / 100;
  return { value, singleSource };
}

// ── Cosine similarity (in-process; no vector DB) ─────────────────────────────────
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let k = 0; k < a.length; k++) {
    dot += a[k] * b[k];
    na += a[k] * a[k];
    nb += b[k] * b[k];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export function meanPairwiseCosine(vectors: number[][]): number | null {
  if (vectors.length < 2) return null;
  let sum = 0, n = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      sum += cosine(vectors[i], vectors[j]);
      n++;
    }
  }
  return n ? sum / n : null;
}

// ── Reversal: impact rank strongly beats attention rank ──────────────────────────
export function isReversal(impactRank: number, attentionRank: number, delta = 5): boolean {
  return attentionRank - impactRank >= delta;
}

// ── Ranking: impact desc, attention as tiebreak ──────────────────────────────────
export function finalRank<T extends { impactScore: number; attentionScore: number }>(issues: T[]): T[] {
  return [...issues].sort((a, b) => b.impactScore - a.impactScore || b.attentionScore - a.attentionScore);
}
