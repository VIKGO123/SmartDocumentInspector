/**
 * fieldQualityLint.ts
 *
 * Runs after extraction, before mergeFieldSources. Catches the failure mode
 * where unrelated values ("Lead Frontend Engineer", "6+", a skills list, a date range)
 * inherit a generic label like "Frontend" due to proximity-based labeling fallbacks.
 *
 * This acts as a safety net: flagged fields get a confidence penalty and lintFlags
 * rather than being silently dropped, preserving them for human review.
 */

import type { ExtractedField } from "./genericScannedDocExtractor";

// Labels that are too generic to trust as-is: bare nouns describing a UI section
// or a nearby heading rather than the actual field concept.
export const GENERIC_LABEL_DENYLIST =
  /^(field|frontend|location|item|value|data|info|section)(\s*\(\d+\))?$/i;

// A label ending in "(2)", "(3)", etc. indicates collision from sequential slugging.
export const NUMBERED_SUFFIX = /\(\d+\)\s*$/;

export interface LintedField extends ExtractedField {
  lintFlags: string[];
}

export function lintFields<T extends ExtractedField>(
  fields: T[]
): (T & { lintFlags: string[] })[] {
  const seenLabelsInBatch = new Map<string, number>();

  return fields.map((field) => {
    const flags: string[] = [];
    const trimmedLabel = field.label.trim();
    const trimmedVal = field.value.trim();

    if (GENERIC_LABEL_DENYLIST.test(trimmedLabel)) {
      flags.push("generic-label");
    }
    if (NUMBERED_SUFFIX.test(field.label)) {
      flags.push("numbered-suffix-label");
    }
    // A value that looks like a heading (short, all-caps, or title-case
    // with no punctuation) masquerading as a field value usually means
    // block reconstruction or labeling mis-stepped.
    if (
      /^[A-Z\s]{4,40}$/.test(trimmedVal) &&
      trimmedVal.split(/\s+/).length <= 4 &&
      !/^\d+$/.test(trimmedVal)
    ) {
      flags.push("value-looks-like-heading");
    }

    const count = (seenLabelsInBatch.get(field.label) ?? 0) + 1;
    seenLabelsInBatch.set(field.label, count);
    if (count > 1) {
      flags.push("duplicate-label-in-batch");
    }

    return {
      ...field,
      // Flagged fields get a confidence penalty rather than being silently dropped.
      // Reviewers can see these flagged fields clearly.
      confidence:
        flags.length > 0
          ? Math.min(field.confidence ?? 0.5, 0.4)
          : field.confidence,
      lintFlags: flags,
    };
  });
}

/**
 * Convenience filter for callers who want a hard cutoff instead of a confidence penalty
 * (e.g. hiding flagged fields from a "quick view" while keeping them in full audit trail).
 */
export function withoutSevereLintIssues<T extends { lintFlags?: string[] }>(
  fields: T[]
): T[] {
  return fields.filter((f) => !f.lintFlags?.includes("generic-label"));
}
