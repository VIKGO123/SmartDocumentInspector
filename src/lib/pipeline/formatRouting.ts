/**
 * formatRouting.ts
 *
 * Wraps per-format reality (PDF, DOCX, DOC, TXT) so every file format
 * produces a list of "extractable units" (either text or image), ready for
 * genericScannedDocExtractor, text Gemini extraction, or vision Gemini extraction.
 */

import { decideExtractionRoute, type ExtractionRoute } from "./ocrFallbackRouting";

export type SupportedFormat = "pdf" | "docx" | "doc" | "txt";

export interface ExtractableUnit {
  kind: "text" | "image";
  route: ExtractionRoute;
  text?: string;
  imageBase64?: string;
  imageMimeType?: "image/png" | "image/jpeg";
}

const MIN_MEANINGFUL_TEXT_LENGTH = 20;

export async function resolveExtractableUnits(
  format: SupportedFormat,
  input: {
    pdfPages?: Array<{
      nativeTextItemCount: number;
      nativeText?: string;
      tesseractMeanConfidence?: number;
      ocrCharacterCount?: number;
      ocrText?: string;
      pageImageBase64: string;
    }>;
    documentText?: string;
    embeddedImages?: Array<{ base64: string; mimeType: "image/png" | "image/jpeg" }>;
  }
): Promise<ExtractableUnit[]> {
  if (format === "pdf") {
    return (input.pdfPages ?? []).map((page) => {
      const route = decideExtractionRoute({
        nativeTextItemCount: page.nativeTextItemCount,
        tesseractMeanConfidence: page.tesseractMeanConfidence,
        ocrCharacterCount: page.ocrCharacterCount,
      });
      if (route === "vision-fallback") {
        return {
          kind: "image",
          route,
          imageBase64: page.pageImageBase64,
          imageMimeType: "image/png",
        };
      }
      return {
        kind: "text",
        route,
        text: route === "native-text" ? page.nativeText : page.ocrText,
      };
    });
  }

  if (format === "txt") {
    return [{ kind: "text", route: "native-text", text: input.documentText ?? "" }];
  }

  // DOCX / DOC
  const text = (input.documentText ?? "").trim();
  if (text.length >= MIN_MEANINGFUL_TEXT_LENGTH) {
    return [{ kind: "text", route: "native-text", text }];
  }

  const embedded = input.embeddedImages ?? [];
  if (embedded.length > 0) {
    return embedded.map((img) => ({
      kind: "image" as const,
      route: "vision-fallback" as const,
      imageBase64: img.base64,
      imageMimeType: img.mimeType,
    }));
  }

  return [];
}
