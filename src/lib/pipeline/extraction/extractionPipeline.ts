/**
 * extractionPipeline.ts
 *
 * Single pipeline entry point that collects fields across all extractable units
 * (text units via regex + AI, image units via vision AI) and executes global
 * deduplication/merging via mergeFieldSources before returning.
 */

import type { ExtractedField } from "./genericScannedDocExtractor";
import { mergeFieldSources, type SourcedField } from "./mergeFields";
import type { ExtractableUnit } from "../formatRouting";
import { extractGenericFields } from "./genericScannedDocExtractor";
import { lintFields } from "./fieldQualityLint";

export interface PipelineResult {
  documentType?: string;
  fields: ExtractedField[];
}

/**
 * @param units          Every page/unit for this document, already routed by resolveExtractableUnits().
 * @param callAiOnText    Text-based Gemini API call.
 * @param callAiOnImage   Vision-based Gemini API call.
 */
export async function runExtractionPipeline(
  units: ExtractableUnit[],
  callAiOnText: (text: string) => Promise<{ documentType?: string; fields: ExtractedField[] }>,
  callAiOnImage: (imageBase64: string, mimeType: string) => Promise<{ documentType?: string; fields: ExtractedField[] }>
): Promise<PipelineResult> {
  const collected: SourcedField[] = [];
  let documentType: string | undefined;

  for (const unit of units) {
    if (unit.kind === "text" && unit.text) {
      // Non-AI pass — free, deterministic, always runs
      const regexFields = extractGenericFields(unit.text);
      collected.push(...regexFields.map((f) => ({ ...f, source: "regex" as const })));

      // AI pass on text
      const aiResult = await callAiOnText(unit.text);
      documentType ??= aiResult.documentType;
      collected.push(...aiResult.fields.map((f) => ({ ...f, source: "ai" as const })));
    }

    if (unit.kind === "image" && unit.imageBase64) {
      // AI vision pass for image/scanned units
      const aiResult = await callAiOnImage(unit.imageBase64, unit.imageMimeType ?? "image/png");
      documentType ??= aiResult.documentType;
      collected.push(...aiResult.fields.map((f) => ({ ...f, source: "ai" as const })));
    }
  }

  // Lint collected fields before merge to catch generic labels, numbered suffixes, etc.
  const linted = lintFields(collected);

  // Global merge & deduplicate across all units and sources
  const mergedFields = mergeFieldSources(linted);

  return { documentType, fields: mergedFields };
}
