import type { ExtractedField } from "./extractionSchema";

const VALIDATORS: Partial<Record<NonNullable<ExtractedField["valueType"]>, RegExp>> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[\d\s().-]{7,}$/,
  url: /^https?:\/\/\S+$/i,
  currency: /^[$₹€£]?\s?[\d,]+(\.\d{1,2})?$/,
  date: /\b(\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s\d{4})\b/,
};

export function mergeFieldConfidence(field: ExtractedField): ExtractedField {
  const llmConfidence = field.confidence ?? 0.5;
  const validator = field.valueType ? VALIDATORS[field.valueType] : undefined;

  if (!validator) {
    // No deterministic check available for this type — trust the model,
    // but never let an unchecked field report near-certainty.
    return { ...field, confidence: Math.min(llmConfidence, 0.85) };
  }

  const passesRegex = validator.test(field.value.trim());

  // Both agree it's well-formed -> high confidence.
  // Model is confident but regex disagrees -> flag it down hard, don't average it away.
  const merged = passesRegex
    ? Math.max(llmConfidence, 0.9)
    : Math.min(llmConfidence, 0.4);

  return { ...field, confidence: Math.round(merged * 100) / 100 };
}
