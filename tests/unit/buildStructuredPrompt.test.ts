import { describe, expect, it } from "vitest";
import {
  buildCompressedOutline,
  buildExtractionPrompt,
  FEW_SHOT_EXAMPLES,
} from "@/lib/gemini/buildStructuredPrompt";
import type { Block } from "@/lib/types";

describe("buildStructuredPrompt Unit Tests", () => {
  it("formats blocks into tagged compressed outlines correctly", () => {
    const blocks: Block[] = [
      {
        id: "b-1",
        type: "heading",
        text: "Jane Doe",
        bbox: { x: 0, y: 0, width: 100, height: 20, page: 1 },
      },
      {
        id: "b-2",
        type: "paragraph",
        text: "Senior Frontend Engineer | React, TypeScript",
        bbox: { x: 0, y: 25, width: 250, height: 15, page: 1 },
      },
      {
        id: "b-3",
        type: "keyValue",
        text: "Email: jane@example.com",
        bbox: { x: 0, y: 45, width: 150, height: 15, page: 1 },
      },
      {
        id: "b-4",
        type: "table",
        text: "Role | Duration | Company",
        bbox: { x: 0, y: 65, width: 300, height: 50, page: 1 },
      },
    ];

    const outline = buildCompressedOutline(blocks);
    expect(outline).toContain("[H1] Jane Doe");
    expect(outline).toContain("[P] Senior Frontend Engineer | React, TypeScript");
    expect(outline).toContain("[KV] Email: jane@example.com");
    expect(outline).toContain("[Table] Role | Duration | Company");
  });

  it("buildExtractionPrompt includes few-shot exemplars and document outline", () => {
    const blocks: Block[] = [
      {
        id: "inv-1",
        type: "heading",
        text: "Invoice #1092",
        bbox: { x: 0, y: 0, width: 100, height: 20, page: 1 },
      },
    ];

    const prompt = buildExtractionPrompt(blocks);

    // Anchors & exemplars
    expect(prompt).toContain(FEW_SHOT_EXAMPLES.trim().slice(0, 40));
    expect(prompt).toContain("Example 1 (resume-shaped input)");
    expect(prompt).toContain("Example 2 (invoice-shaped input)");
    expect(prompt).toContain("Example 3 (ID-document-shaped input)");

    // Rules
    expect(prompt).toContain("EVERY field needs its own specific label");
    expect(prompt).toContain('use "Unlabeled" rather than');

    // Document content
    expect(prompt).toContain("[H1] Invoice #1092");
  });
});
