import type { Block, PositionedItem } from "@/lib/types";
import { classifyLines } from "./blockClassifier";
import { detectColumns, readingOrder } from "./columnDetection";
import { groupLines } from "./lineGrouping";
import { detectTables } from "./tableDetection";

export function reconstructBlocks(items: PositionedItem[]): Block[] {
  const lines = groupLines(items);
  const columns = detectColumns(lines);
  const ordered = readingOrder(columns);
  const classified = classifyLines(ordered);
  return detectTables(ordered, classified);
}

export function blocksFromPlainText(text: string): Block[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const items: PositionedItem[] = lines.map((line, i) => ({
    text: line,
    confidence: 1,
    fontSize: 12,
    bbox: { x: 40, y: 40 + i * 18, width: Math.max(80, line.length * 7), height: 14, page: 1 },
  }));
  return reconstructBlocks(items);
}
