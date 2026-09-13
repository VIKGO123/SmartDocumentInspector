/**
 * mergeFields.ts
 *
 * Merges and deduplicates fields across an entire document.
 * Collapses duplicate values (e.g. email/phone repeated in header and footer)
 * into a single canonical field while preserving distinct values.
 */

import type { ExtractedField } from "./genericScannedDocExtractor";

export interface SourcedField extends ExtractedField {
  source?: "regex" | "ai" | "local";
  lintFlags?: string[];
}

export function mergeFieldSources(fields: SourcedField[]): (ExtractedField & { lintFlags?: string[] })[] {
  const valueGroups = new Map<string, SourcedField[]>();

  for (const field of fields) {
    if (!field.value || !field.value.trim()) continue;
    const normVal = normalize(field.value);
    const existing = valueGroups.get(normVal) ?? [];
    existing.push(field);
    valueGroups.set(normVal, existing);
  }

  const result: (ExtractedField & { lintFlags?: string[] })[] = [];

  for (const group of valueGroups.values()) {
    // Pick highest confidence candidate
    group.sort((a, b) => {
      const confA = a.confidence ?? 0.5;
      const confB = b.confidence ?? 0.5;
      if (confA !== confB) return confB - confA;
      // Prefer non-numbered label over numbered label
      const isNumA = /\(\d+\)$/.test(a.label);
      const isNumB = /\(\d+\)$/.test(b.label);
      if (isNumA !== isNumB) return isNumA ? 1 : -1;
      return 0;
    });

    const best = group[0];
    const cleanLabel = best.label.replace(/\s*\(\d+\)$/, "").trim();

    result.push({
      label: cleanLabel || best.label,
      value: best.value,
      valueType: best.valueType,
      confidence: best.confidence ?? 0.75,
      ...(best.lintFlags && best.lintFlags.length > 0 ? { lintFlags: best.lintFlags } : {}),
    });
  }

  return result;
}

function normalize(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}
