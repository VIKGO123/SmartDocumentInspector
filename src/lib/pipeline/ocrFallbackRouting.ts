/**
 * ocrFallbackRouting.ts
 *
 * Page quality signals & extraction routing decider.
 * Determines whether to route via native digital text, OCR text,
 * or direct vision AI fallback.
 */

export interface PageQualitySignals {
  nativeTextItemCount: number; // PDF digital text item count
  tesseractMeanConfidence?: number; // 0-100 OCR confidence
  ocrCharacterCount?: number; // character count after OCR
}

export type ExtractionRoute = "native-text" | "ocr-text" | "vision-fallback";

/**
 * Decide per page which extraction route to execute based on quality signals.
 */
export function decideExtractionRoute(signals: PageQualitySignals): ExtractionRoute {
  if (signals.nativeTextItemCount >= 4) {
    return "native-text";
  }

  const ranOcr = signals.tesseractMeanConfidence != null;
  const ocrLooksReliable =
    ranOcr &&
    (signals.tesseractMeanConfidence ?? 0) >= 60 &&
    (signals.ocrCharacterCount ?? 0) >= 20;

  return ocrLooksReliable ? "ocr-text" : "vision-fallback";
}
