import { describe, expect, it } from "vitest";
import { inferFieldLabel, applyInferredLabels } from "@/lib/pipeline/extraction/inferLabel";
import { wrapIndex } from "@/lib/search/textMatch";
import type { Block } from "@/lib/types";

const bbox = { x: 0, y: 0, width: 40, height: 12, page: 1 };

function field(
  partial: { key: string; value: string; valueType: "money" | "text" | "url" | "email" | "location" | "person" } & {
    sourceBlockId?: string;
  },
) {
  return {
    sourceBlockId: "b1",
    ...partial,
  };
}

describe("inferFieldLabel", () => {
  it("uses the document's own cue before a colon", () => {
    const blocks: Block[] = [
      { id: "b1", type: "keyValue", text: "Amount due: $1,400.00", bbox },
    ];
    expect(
      inferFieldLabel(field({ key: "Total due", value: "$1,400.00", valueType: "money" }), blocks),
    ).toBe("Amount due");
  });

  it("uses a skill heading from the same line", () => {
    const blocks: Block[] = [
      {
        id: "b1",
        type: "keyValue",
        text: "Frontend: React, Next.js, TypeScript",
        bbox,
      },
    ];
    expect(
      inferFieldLabel(
        field({ key: "Org", value: "React, Next.js, TypeScript", valueType: "text" }),
        blocks,
      ),
    ).toBe("Frontend");
  });

  it("does not copy the value or nearby document data into the label", () => {
    const blocks: Block[] = [
      { id: "b0", type: "heading", text: "BlackRock", bbox },
      { id: "b1", type: "paragraph", text: "Gurugram, India", bbox },
    ];
    const location = inferFieldLabel(
      field({ key: "BlackRock", value: "Gurugram, India", valueType: "location" }),
      blocks,
    );
    expect(location).toBe("Location");
    expect(location).not.toBe("Gurugram, India");
    expect(location).not.toBe("BlackRock");
  });

  it("does not use an education line as the label", () => {
    const blocks: Block[] = [
      {
        id: "b1",
        type: "keyValue",
        text: "B.E. in Computer Engineering 2016 – 2020",
        bbox,
      },
    ];
    const label = inferFieldLabel(
      field({
        key: "B.E. in Computer Engineering 2016",
        value: "2020",
        valueType: "text",
      }),
      blocks,
    );
    expect(label).not.toMatch(/2016|Computer Engineering/);
  });

  it("falls back to a type name for a URL rather than the host from the value", () => {
    expect(
      inferFieldLabel(
        field({
          key: "URL",
          value: "https://www.linkedin.com/in/vikgo-27/",
          valueType: "url",
        }),
        [],
      ),
    ).toBe("URL");
  });

  it("does not treat a city as the label for an email on the same line", () => {
    const blocks: Block[] = [
      {
        id: "b1",
        type: "paragraph",
        text: "Gurugram, India | jane@acme.com | +91 9872194452",
        bbox,
      },
    ];
    const label = inferFieldLabel(
      field({ key: "Email", value: "jane@acme.com", valueType: "email" }),
      blocks,
    );
    expect(label).toBe("Email");
    expect(label.toLowerCase()).not.toContain("gurugram");
  });

  it("protects schemaKey fields from being overwritten by loose block cues", () => {
    const blocks: Block[] = [
      {
        id: "b1",
        type: "paragraph",
        text: "Frontend Engineer at Acme Corp with 6+ years experience",
        bbox,
      },
    ];
    // A field already bound to a schema (e.g. Job Title)
    const jobTitleField = {
      ...field({ key: "Job Title", value: "Lead Engineer", valueType: "text" }),
      schemaKey: "job_title",
    };
    const label = inferFieldLabel(jobTitleField, blocks);
    expect(label).toBe("Job Title");
  });

  it("stops loose proximity cues from stampeding into Frontend (2), (3), (4) on multiple fields", () => {
    const blocks: Block[] = [
      {
        id: "b1",
        type: "paragraph",
        text: "Frontend expertise in React, Next.js, Redux, and TypeScript. Also skilled in backend Go and Docker.",
        bbox,
      },
    ];

    const fields = [
      { key: "Field", value: "React, Next.js", valueType: "text" as const, sourceBlockId: "b1" },
      { key: "Field", value: "6+ years", valueType: "text" as const, sourceBlockId: "b1" },
      { key: "Field", value: "San Francisco, CA", valueType: "location" as const, sourceBlockId: "b1" },
    ];

    const labeled = applyInferredLabels(fields, blocks);

    // The first one can get Frontend
    expect(labeled[0].key).toBe("Frontend");
    expect(labeled[0].labelProvenance).toBe("inferred");

    // The subsequent ones in the same block MUST NOT get "Frontend (2)"!
    // Instead they fall back cleanly to their type labels.
    expect(labeled[1].key).not.toBe("Frontend (2)");
    expect(labeled[1].key).toBe("Field");
    expect(labeled[2].key).toBe("Location");
  });
});

describe("wrapIndex", () => {
  it("cycles forward and backward", () => {
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(-1, 3)).toBe(2);
  });
});
