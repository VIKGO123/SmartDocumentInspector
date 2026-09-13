import { describe, expect, it } from "vitest";
import { resolveExtractableUnits } from "@/lib/pipeline/formatRouting";

describe("formatRouting", () => {
  it("resolves PDF pages using quality routing signals", async () => {
    const units = await resolveExtractableUnits("pdf", {
      pdfPages: [
        {
          nativeTextItemCount: 15,
          nativeText: "Digital PDF Text Page 1",
          pageImageBase64: "base64data",
        },
        {
          nativeTextItemCount: 0,
          tesseractMeanConfidence: 20,
          ocrCharacterCount: 5,
          pageImageBase64: "base64data_page2",
        },
      ],
    });

    expect(units).toHaveLength(2);
    expect(units[0]).toEqual({
      kind: "text",
      route: "native-text",
      text: "Digital PDF Text Page 1",
    });
    expect(units[1]).toEqual({
      kind: "image",
      route: "vision-fallback",
      imageBase64: "base64data_page2",
      imageMimeType: "image/png",
    });
  });

  it("resolves plain TXT format as native-text unit", async () => {
    const units = await resolveExtractableUnits("txt", {
      documentText: "Hello world, plain text document.",
    });
    expect(units).toHaveLength(1);
    expect(units[0]).toEqual({
      kind: "text",
      route: "native-text",
      text: "Hello world, plain text document.",
    });
  });

  it("resolves DOCX with text >= 20 chars as native-text", async () => {
    const units = await resolveExtractableUnits("docx", {
      documentText: "This Word document has plenty of meaningful text extracted.",
    });
    expect(units).toHaveLength(1);
    expect(units[0].kind).toBe("text");
    expect(units[0].route).toBe("native-text");
  });

  it("falls back to embedded images for DOCX with sparse text", async () => {
    const units = await resolveExtractableUnits("docx", {
      documentText: "   ",
      embeddedImages: [
        { base64: "imgdata123", mimeType: "image/png" },
      ],
    });
    expect(units).toHaveLength(1);
    expect(units[0]).toEqual({
      kind: "image",
      route: "vision-fallback",
      imageBase64: "imgdata123",
      imageMimeType: "image/png",
    });
  });
});
