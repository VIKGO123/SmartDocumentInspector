import type { Block, BlockType } from "@/lib/types";
import type { Line } from "./lineGrouping";

const LIST_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;
const KV_RE = /^(.{1,48}?)\s*[:–—]\s+(.{1,200})$/;

export function classifyLines(lines: Line[]): Block[] {
  const medianSize = median(lines.map((l) => l.fontSize));
  return lines.map((line, i) => {
    const type = classifyLine(line, medianSize);
    return {
      id: `block-${line.bbox.page}-${i}`,
      type,
      text: line.text,
      bbox: line.bbox,
      confidence: averageConfidence(line),
    };
  });
}

export function classifyLine(line: Line, medianSize: number): BlockType {
  const text = line.text.trim();
  if (!text) return "paragraph";
  if (LIST_RE.test(text)) return "listItem";
  if (KV_RE.test(text) && text.length < 140) return "keyValue";
  if (
    line.fontSize > medianSize * 1.25 ||
    (text.length < 48 && text === text.toUpperCase() && /[A-Z]/.test(text))
  ) {
    return "heading";
  }
  return "paragraph";
}

function averageConfidence(line: Line): number {
  const values = line.items
    .map((i) => i.confidence)
    .filter((c): c is number => typeof c === "number");
  if (!values.length) return 1;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(nums: number[]): number {
  if (!nums.length) return 12;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
