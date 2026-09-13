import { describe, expect, it } from "vitest";
import { mergeFieldSources, type SourcedField } from "@/lib/pipeline/extraction/mergeFields";
import { runExtractionPipeline } from "@/lib/pipeline/extraction/extractionPipeline";
import type { ExtractableUnit } from "@/lib/pipeline/formatRouting";

describe("mergeFields regression fixture", () => {
  it("collapses real duplicate email and phone fields while keeping distinct values under similar labels", () => {
    const sampleFields: SourcedField[] = [
      { label: "Email", value: "vikashpathak2797@gmail.com", confidence: 0.9, source: "ai" },
      { label: "Email (2)", value: "vikashpathak2797@gmail.com", confidence: 0.88, source: "ai" },
      { label: "Phone", value: "+91 9872194452", confidence: 0.9, source: "ai" },
      { label: "Phone (2)", value: "+91 9872194452", confidence: 0.84, source: "ai" },
      { label: "Frontend", value: "Lead Frontend Engineer", confidence: 0.9, source: "ai" },
      { label: "Frontend (2)", value: "Fintech & AI Systems | React, Next.js, Angular, TypeScript", confidence: 0.9, source: "ai" },
      { label: "Frontend (3)", value: "6+", confidence: 0.9, source: "ai" },
    ];

    const merged = mergeFieldSources(sampleFields);

    const emailFields = merged.filter((f) => f.value === "vikashpathak2797@gmail.com");
    expect(emailFields).toHaveLength(1);
    expect(emailFields[0].label).toBe("Email");

    const phoneFields = merged.filter((f) => f.value === "+91 9872194452");
    expect(phoneFields).toHaveLength(1);
    expect(phoneFields[0].label).toBe("Phone");

    const distinctFrontendValues = new Set(
      merged.filter((f) => f.label.startsWith("Frontend")).map((f) => f.value)
    );
    expect(distinctFrontendValues.size).toBe(3);
  });

  it("orchestrates text and image units through runExtractionPipeline", async () => {
    const units: ExtractableUnit[] = [
      {
        kind: "text",
        route: "native-text",
        text: "Invoice No: 1001\nEmail: test@example.com",
      },
      {
        kind: "image",
        route: "vision-fallback",
        imageBase64: "imgdata",
      },
    ];

    const mockCallAiOnText = async () => ({
      documentType: "Invoice",
      fields: [{ label: "Invoice No", value: "1001", confidence: 0.95 }],
    });

    const mockCallAiOnImage = async () => ({
      documentType: "Invoice",
      fields: [{ label: "Total Amount", value: "$500.00", confidence: 0.9 }],
    });

    const res = await runExtractionPipeline(units, mockCallAiOnText, mockCallAiOnImage);

    expect(res.documentType).toBe("Invoice");
    expect(res.fields.some((f) => f.label === "Invoice No" && f.value === "1001")).toBe(true);
    expect(res.fields.some((f) => f.label === "Total Amount" && f.value === "$500.00")).toBe(true);
    expect(res.fields.some((f) => f.label === "Email" && f.value === "test@example.com")).toBe(true);
  });
});
