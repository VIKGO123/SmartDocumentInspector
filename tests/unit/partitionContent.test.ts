import { describe, expect, it } from "vitest";
import { hasClassifiedName, partitionDocumentContent } from "@/lib/pipeline/extraction/partitionContent";
import type { Block, FieldRecord } from "@/lib/types";

const bbox = { x: 0, y: 0, width: 40, height: 12, page: 1 };

function field(partial: Partial<FieldRecord> & Pick<FieldRecord, "key" | "value">): FieldRecord {
  return {
    id: partial.id ?? crypto.randomUUID(),
    documentId: "d1",
    valueType: "text",
    confidence: 0.9,
    tier: "high",
    bbox,
    sourceBlockId: "b1",
    edited: false,
    editHistory: [],
    ...partial,
  };
}

describe("partitionDocumentContent", () => {
  it("keeps named schema and labeled values as fields", () => {
    expect(hasClassifiedName(field({ key: "Name", value: "Ada Lovelace", schemaKey: "name", valueType: "person" }))).toBe(
      true,
    );
    expect(hasClassifiedName(field({ key: "Email", value: "ada@example.com", valueType: "email" }))).toBe(true);
    expect(hasClassifiedName(field({ key: "Frontend", value: "React, Next.js" }))).toBe(true);
  });

  it("sends unnamed NER hits and leftover prose to notes", () => {
    const blocks: Block[] = [
      { id: "h", type: "heading", text: "PROFESSIONAL SUMMARY", bbox },
      {
        id: "p",
        type: "paragraph",
        text: "Built high-performance compliance tools for institutional trading operations.",
        bbox,
      },
    ];
    const { fields, notes } = partitionDocumentContent(
      [
        field({ key: "Name", value: "ADA LOVELACE", schemaKey: "name", valueType: "person" }),
        field({ key: "Person", value: "BlackRock", valueType: "person" }),
        field({ key: "Org (2)", value: "Guardian Life", valueType: "org" }),
      ],
      blocks,
      [],
    );
    expect(fields.map((f) => f.key)).toEqual(["Name"]);
    expect(notes.some((n) => n.includes("compliance tools"))).toBe(true);
    expect(notes).toContain("BlackRock");
    expect(notes).toContain("Guardian Life");
  });

  it("safely handles undefined or null blocks and fields without throwing", () => {
    const result1 = partitionDocumentContent(undefined, undefined, undefined);
    expect(result1).toEqual({ fields: [], notes: [] });

    // @ts-expect-error testing null runtime robustness
    const result2 = partitionDocumentContent(null, null, null);
    expect(result2).toEqual({ fields: [], notes: [] });
  });
});
