import { describe, expect, it } from "vitest";
import {
  looksGarbled,
  patternStrength,
  scoreField,
  tierFromScore,
} from "@/lib/pipeline/confidence";

describe("confidence scoring", () => {
  it("maps scores to tiers", () => {
    expect(tierFromScore(0.9)).toBe("high");
    expect(tierFromScore(0.6)).toBe("medium");
    expect(tierFromScore(0.2)).toBe("low");
  });

  it("weights OCR, pattern, fingerprint, and completeness", () => {
    const high = scoreField({
      ocrConfidence: 1,
      patternStrength: 1,
      fingerprintBoost: 0.9,
      completeness: 1,
    });
    expect(high.tier).toBe("high");
    const low = scoreField({
      ocrConfidence: 0.2,
      patternStrength: 0.3,
      fingerprintBoost: 0.4,
      completeness: 0,
    });
    expect(low.tier).toBe("low");
  });

  it("flags OCR-looking O/0 confusion", () => {
    expect(looksGarbled("O400")).toBe(true);
    expect(patternStrength("email", "a@b.com")).toBeGreaterThan(0.8);
  });
});
