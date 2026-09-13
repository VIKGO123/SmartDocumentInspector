import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "@/lib/gemini/buildPrompt";
import { mergeFieldConfidence } from "@/lib/gemini/mergeConfidence";
import { extractionResponseSchema } from "@/lib/gemini/extractionSchema";
import type { Block } from "@/lib/types";

describe("Gemini Schema-Free Extraction Unit Tests", () => {
  it("builds prompt preserving block ID, page, and type tags", () => {
    const blocks: Block[] = [
      {
        id: "block-1",
        type: "heading",
        text: "Professional Experience",
        bbox: { x: 10, y: 20, width: 200, height: 30, page: 1 },
      },
      {
        id: "block-2",
        type: "paragraph",
        text: "Senior Software Engineer at Acme Corp",
        bbox: { x: 10, y: 60, width: 400, height: 20, page: 1 },
      },
    ];

    const prompt = buildExtractionPrompt(blocks);
    expect(prompt).toContain("[block id=block-1 page=1 type=heading]");
    expect(prompt).toContain("Professional Experience");
    expect(prompt).toContain("[block id=block-2 page=1 type=paragraph]");
    expect(prompt).toContain("Senior Software Engineer at Acme Corp");
  });

  it("reconciles LLM confidence with deterministic regex checks", () => {
    // Valid email with low LLM confidence -> boosted by regex pass
    const emailField = mergeFieldConfidence({
      label: "Email",
      value: "user@example.com",
      valueType: "email",
      confidence: 0.6,
    });
    expect(emailField.confidence).toBeGreaterThanOrEqual(0.9);

    // Invalid email with high LLM confidence -> penalized by regex fail
    const badEmail = mergeFieldConfidence({
      label: "Email",
      value: "not-an-email",
      valueType: "email",
      confidence: 0.95,
    });
    expect(badEmail.confidence).toBeLessThanOrEqual(0.4);

    // Unchecked text field with high LLM confidence -> capped at 0.85
    const textFields = mergeFieldConfidence({
      label: "Specialization",
      value: "Full-Stack Development",
      confidence: 0.99,
    });
    expect(textFields.confidence).toBe(0.85);
  });

  it("exposes valid OpenAPI OpenAPI-subset schema for Gemini config", () => {
    expect(extractionResponseSchema.type).toBe("OBJECT");
    expect(extractionResponseSchema.properties).toHaveProperty("documentType");
    expect(extractionResponseSchema.properties).toHaveProperty("sections");
  });
});
