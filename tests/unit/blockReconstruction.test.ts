import { describe, expect, it } from "vitest";
import { classifyLine } from "@/lib/pipeline/blockReconstruction/blockClassifier";
import { detectColumns, readingOrder } from "@/lib/pipeline/blockReconstruction/columnDetection";
import { reconstructBlocks } from "@/lib/pipeline/blockReconstruction";
import { groupLines, type Line } from "@/lib/pipeline/blockReconstruction/lineGrouping";
import type { PositionedItem } from "@/lib/types";

function item(text: string, x: number, y: number, page = 1, w = 40): PositionedItem {
  return {
    text,
    fontSize: 12,
    confidence: 1,
    bbox: { x, y, width: w, height: 12, page },
  };
}

describe("line grouping", () => {
  it("joins items on the same baseline left to right", () => {
    const lines = groupLines([
      item("world", 80, 40),
      item("hello", 10, 42),
      item("next", 10, 80),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["hello world", "next"]);
  });
});

describe("column detection", () => {
  it("reads left column then right column", () => {
    const left: Line[] = [
      { text: "A1", items: [item("A1", 20, 20, 1, 30)], bbox: { x: 20, y: 20, width: 30, height: 12, page: 1 }, fontSize: 12 },
      { text: "A2", items: [item("A2", 20, 50, 1, 30)], bbox: { x: 20, y: 50, width: 30, height: 12, page: 1 }, fontSize: 12 },
      { text: "A3", items: [item("A3", 20, 80, 1, 30)], bbox: { x: 20, y: 80, width: 30, height: 12, page: 1 }, fontSize: 12 },
    ];
    const right: Line[] = [
      { text: "B1", items: [item("B1", 300, 22, 1, 30)], bbox: { x: 300, y: 22, width: 30, height: 12, page: 1 }, fontSize: 12 },
      { text: "B2", items: [item("B2", 300, 52, 1, 30)], bbox: { x: 300, y: 52, width: 30, height: 12, page: 1 }, fontSize: 12 },
      { text: "B3", items: [item("B3", 300, 82, 1, 30)], bbox: { x: 300, y: 82, width: 30, height: 12, page: 1 }, fontSize: 12 },
    ];
    const cols = detectColumns([...left, ...right]);
    const order = readingOrder(cols).map((l) => l.text);
    expect(order[0]).toBe("A1");
    expect(order[order.length - 1]).toBe("B3");
  });
});

describe("block classifier", () => {
  it("labels headings, lists, and key-value lines", () => {
    const heading: Line = {
      text: "INVOICE",
      items: [item("INVOICE", 10, 10, 1, 80)],
      bbox: { x: 10, y: 10, width: 80, height: 22, page: 1 },
      fontSize: 22,
    };
    expect(classifyLine(heading, 12)).toBe("heading");
    const list: Line = {
      text: "- deliverable one",
      items: [item("- deliverable one", 10, 40, 1, 120)],
      bbox: { x: 10, y: 40, width: 120, height: 12, page: 1 },
      fontSize: 12,
    };
    expect(classifyLine(list, 12)).toBe("listItem");
    const kv: Line = {
      text: "Email: jane@acme.com",
      items: [item("Email: jane@acme.com", 10, 60, 1, 160)],
      bbox: { x: 10, y: 60, width: 160, height: 12, page: 1 },
      fontSize: 12,
    };
    expect(classifyLine(kv, 12)).toBe("keyValue");
  });
});

describe("reconstruction", () => {
  it("emits ordered blocks from positioned items", () => {
    const blocks = reconstructBlocks([
      item("Title", 20, 10, 1, 80),
      item("Email:", 20, 40, 1, 40),
      item("a@b.com", 70, 40, 1, 80),
    ]);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => b.text.includes("a@b.com"))).toBe(true);
  });
});
