import { describe, expect, it } from "vitest";
import { decideExtractionRoute } from "@/lib/pipeline/ocrFallbackRouting";

describe("ocrFallbackRouting", () => {
  it("routes to native-text when native items >= 4", () => {
    const route = decideExtractionRoute({ nativeTextItemCount: 10 });
    expect(route).toBe("native-text");
  });

  it("routes to ocr-text when native items < 4 but OCR confidence >= 60 and char count >= 20", () => {
    const route = decideExtractionRoute({
      nativeTextItemCount: 1,
      tesseractMeanConfidence: 85,
      ocrCharacterCount: 120,
    });
    expect(route).toBe("ocr-text");
  });

  it("routes to vision-fallback when OCR confidence is low or character count is sparse", () => {
    const routeLowConf = decideExtractionRoute({
      nativeTextItemCount: 0,
      tesseractMeanConfidence: 30,
      ocrCharacterCount: 50,
    });
    expect(routeLowConf).toBe("vision-fallback");

    const routeLowChars = decideExtractionRoute({
      nativeTextItemCount: 0,
      tesseractMeanConfidence: 90,
      ocrCharacterCount: 5,
    });
    expect(routeLowChars).toBe("vision-fallback");
  });
});
