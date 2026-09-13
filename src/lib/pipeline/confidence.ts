import type { ConfidenceTier, FieldProvenance, FieldRecord } from "@/lib/types";

export function tierFromScore(score: number): ConfidenceTier {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function scoreField(input: {
  ocrConfidence: number;
  patternStrength: number;
  fingerprintBoost: number;
  completeness: number;
  provenance?: FieldProvenance;
  groundingScore?: number;
}): { confidence: number; tier: ConfidenceTier } {
  let confidence: number;

  if (input.provenance && input.provenance !== "local") {
    const grounding = input.groundingScore ?? 0.5;
    confidence = clamp(
      0.3 * input.ocrConfidence +
        0.3 * input.patternStrength +
        0.3 * grounding +
        0.1 * input.completeness,
      0,
      1,
    );
  } else {
    confidence = clamp(
      0.4 * input.ocrConfidence +
        0.3 * input.patternStrength +
        0.2 * input.fingerprintBoost +
        0.1 * input.completeness,
      0,
      1,
    );
  }

  let tier = tierFromScore(confidence);

  // Hard Rule: any cloud-inferred field is capped at 'medium' tier, never 'high'
  if (input.provenance === "cloud-inferred") {
    confidence = Math.min(confidence, 0.79);
    if (tier === "high") tier = "medium";
  }

  return { confidence, tier };
}

export function patternStrength(valueType: FieldRecord["valueType"], value: string): number {
  if (!value.trim()) return 0;
  switch (valueType) {
    case "email":
      return /.+@.+\..+/.test(value) ? 1 : 0.3;
    case "money":
      return /[\d.]/.test(value) ? 0.9 : 0.4;
    case "date":
      return /\d/.test(value) ? 0.85 : 0.4;
    case "phone":
      return /\d{7,}/.test(value.replace(/\D/g, "")) ? 0.85 : 0.4;
    case "url":
      return /^https?:\/\//.test(value) ? 1 : 0.4;
    case "table":
      return 0.7;
    default:
      return value.length > 2 ? 0.7 : 0.4;
  }
}

export function looksGarbled(value: string): boolean {
  return /[O](?=\d)|\d(?=[O])|[Il](?=\d)/.test(value);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
