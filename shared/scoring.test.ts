// Tests for the load-bearing scoring math. These lock the numbers the whole
// product rests on — if any of these break, an impact score or the overrule has
// silently drifted.
import { describe, expect, it } from "vitest";
import {
  computeAttention,
  computeImpact,
  computeQuadrant,
  deriveConfidence,
  isReversal,
} from "./scoring.ts";

describe("computeImpact", () => {
  it("reproduces the locked HC-1 score (81)", () => {
    // severity 5/5 = 1.0, exposure 0.93 (Open Buildings), vulnerability 0.87 (Data Commons)
    expect(computeImpact(1.0, 0.93, 0.87)).toBe(81);
  });

  it("reproduces the locked pothole score (19)", () => {
    // severity 2/5 = 0.40, exposure 0.55, vulnerability 0.87
    expect(computeImpact(0.4, 0.55, 0.87)).toBe(19);
  });

  it("clamps inputs into 0..1 (never NaN, never >100)", () => {
    expect(computeImpact(2, 2, 2)).toBe(100);
    expect(computeImpact(-1, 0.5, 0.5)).toBe(0);
  });
});

describe("computeAttention", () => {
  it("is the crowd signal only and stays within 0..1", () => {
    const a = computeAttention({
      alarmIntensityMean: 0.8,
      upvotes: 12,
      replies: 4,
      maxWardEngagement: 20,
      recencyNorm: 1,
    });
    expect(a).toBeGreaterThan(0.5); // a loud, fresh, engaged issue
    expect(a).toBeLessThanOrEqual(1);
  });

  it("a quiet issue scores low", () => {
    const a = computeAttention({
      alarmIntensityMean: 0.17,
      upvotes: 1,
      replies: 0,
      maxWardEngagement: 20,
      recencyNorm: 0.33,
    });
    expect(a).toBeLessThan(0.3);
  });
});

describe("computeQuadrant", () => {
  it("high impact + low attention is a hidden crisis (the drain)", () => {
    expect(computeQuadrant(0.17, 81)).toBe("hidden_crisis");
  });
  it("low impact + high attention is noise (the pothole)", () => {
    expect(computeQuadrant(0.78, 19)).toBe("noise");
  });
  it("high on both is critical", () => {
    expect(computeQuadrant(0.8, 80)).toBe("critical");
  });
});

describe("isReversal", () => {
  it("fires when impact rank strongly beats attention rank (HC-1: #1 vs #5)", () => {
    // delta default 5; the spec's structural overrule uses delta 4 — both fire here.
    expect(isReversal(1, 5, 4)).toBe(true);
  });
  it("does not fire for a small gap", () => {
    expect(isReversal(2, 3, 4)).toBe(false);
  });
});

describe("deriveConfidence", () => {
  it("is derived from inputs, not LLM-rated, and bounded 0..1", () => {
    const { value, singleSource } = deriveConfidence({
      contributingCount: 2,
      adminLevel: "district",
      meanPairwiseCosine: 0.874,
    });
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);
    expect(singleSource).toBe(false);
  });
  it("flags a single-source cluster", () => {
    const { singleSource } = deriveConfidence({
      contributingCount: 1,
      adminLevel: "district",
      meanPairwiseCosine: null,
    });
    expect(singleSource).toBe(true);
  });
});
