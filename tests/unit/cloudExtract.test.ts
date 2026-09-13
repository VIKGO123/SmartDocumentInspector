import { describe, expect, it } from "vitest";
import { computeGrounding } from "@/lib/cloudExtract/grounding";
import { scoreField } from "@/lib/pipeline/confidence";
import { buildCloudExtractPrompt } from "@/lib/cloudExtract/promptTemplate";
import { CloudExtractionResponseSchema } from "@/lib/cloudExtract/schema";

describe("Cloud Assist grounding & scoring", () => {
  it("detects verbatim matches in raw text", () => {
    const rawText = "Invoice #INV-9901 dated 2026-09-12 from Acme Corp";
    const res = computeGrounding("Acme Corp", rawText);
    expect(res.provenance).toBe("cloud-verbatim");
    expect(res.groundingScore).toBe(1.0);
  });

  it("detects synthesized / inferred values", () => {
    const rawText = "Experienced senior engineer skilled in React and Node";
    const res = computeGrounding("Specialization: Full-Stack Web Development", rawText);
    expect(res.provenance).toBe("cloud-inferred");
    expect(res.groundingScore).toBeLessThan(0.8);
  });

  it("caps cloud-inferred fields at medium tier max", () => {
    const scored = scoreField({
      ocrConfidence: 1,
      patternStrength: 1,
      fingerprintBoost: 1,
      completeness: 1,
      provenance: "cloud-inferred",
      groundingScore: 0.5,
    });
    expect(scored.tier).not.toBe("high");
    expect(scored.tier).toBe("medium");
    expect(scored.confidence).toBeLessThanOrEqual(0.79);
  });

  it("allows cloud-verbatim fields to reach high tier when grounded", () => {
    const scored = scoreField({
      ocrConfidence: 1,
      patternStrength: 1,
      fingerprintBoost: 1,
      completeness: 1,
      provenance: "cloud-verbatim",
      groundingScore: 1.0,
    });
    expect(scored.tier).toBe("high");
    expect(scored.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("formats prompt template with existing field keys", () => {
    const prompt = buildCloudExtractPrompt("test.pdf", "Sample text", ["Total", "Vendor"]);
    expect(prompt).toContain("test.pdf");
    expect(prompt).toContain("Total, Vendor");
  });

  it("validates Gemini response schema with zod", () => {
    const sampleResponse = {
      documentSummary: "Test Summary",
      detectedType: "Invoice",
      fields: [
        {
          key: "Specialization",
          value: "Frontend Architecture",
          valueType: "text",
        },
      ],
    };
    const parsed = CloudExtractionResponseSchema.parse(sampleResponse);
    expect(parsed.fields.length).toBe(1);
    expect(parsed.fields[0].key).toBe("Specialization");
  });
});
