import type { Block, PositionedItem } from "@/lib/types";
import type { Line } from "./lineGrouping";

const BAND = 12;

export function detectTables(lines: Line[], existing: Block[]): Block[] {
  if (lines.length < 3) return existing;
  const byPage = new Map<number, Line[]>();
  for (const line of lines) {
    const list = byPage.get(line.bbox.page) ?? [];
    list.push(line);
    byPage.set(line.bbox.page, list);
  }

  const tables: Block[] = [];
  const consumed = new Set<string>();

  for (const [, pageLines] of byPage) {
    const clusters = clusterByXBands(pageLines);
    for (const cluster of clusters) {
      if (cluster.length < 3) continue;
      const cells = cluster.map((line) => splitByBands(line));
      if (cells.every((row) => row.length < 2)) continue;
      const colCount = Math.max(...cells.map((r) => r.length));
      if (colCount < 2) continue;
      const bbox = unionBBox(cluster);
      tables.push({
        id: `table-${bbox.page}-${Math.round(bbox.y)}`,
        type: "table",
        text: cells.map((r) => r.join(" | ")).join("\n"),
        cells,
        bbox,
        confidence: 0.7,
      });
      for (const line of cluster) consumed.add(lineKey(line));
    }
  }

  if (!tables.length) return existing;
  const remaining = existing.filter((b) => {
    if (b.type === "table") return true;
    return !consumed.has(`${b.bbox.page}:${Math.round(b.bbox.y)}:${b.text}`);
  });
  return [...tables, ...remaining].sort((a, b) =>
    a.bbox.page === b.bbox.page ? a.bbox.y - b.bbox.y : a.bbox.page - b.bbox.page,
  );
}

function clusterByXBands(lines: Line[]): Line[][] {
  const scored = lines.map((line) => ({
    line,
    xs: line.items.map((i) => band(i.bbox.x)),
  }));
  const groups: Line[][] = [];
  const used = new Set<Line>();
  for (const { line, xs } of scored) {
    if (used.has(line) || xs.length < 2) continue;
    const group = [line];
    used.add(line);
    for (const other of scored) {
      if (used.has(other.line)) continue;
      const overlap = xs.filter((x) => other.xs.includes(x)).length;
      if (overlap >= 2 && Math.abs(other.line.bbox.y - line.bbox.y) < 220) {
        group.push(other.line);
        used.add(other.line);
      }
    }
    if (group.length >= 3) groups.push(group.sort((a, b) => a.bbox.y - b.bbox.y));
  }
  return groups;
}

function splitByBands(line: Line): string[] {
  const sorted = [...line.items].sort((a, b) => a.bbox.x - b.bbox.x);
  const cells: string[] = [];
  let current: PositionedItem[] = [];
  for (const item of sorted) {
    if (!current.length) {
      current.push(item);
      continue;
    }
    const prev = current[current.length - 1];
    const gap = item.bbox.x - (prev.bbox.x + prev.bbox.width);
    if (gap > BAND * 1.8) {
      cells.push(current.map((i) => i.text).join(" "));
      current = [item];
    } else {
      current.push(item);
    }
  }
  if (current.length) cells.push(current.map((i) => i.text).join(" "));
  return cells;
}

function band(x: number): number {
  return Math.round(x / BAND) * BAND;
}

function unionBBox(lines: Line[]) {
  const first = lines[0].bbox;
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.width;
  let maxY = first.y + first.height;
  for (const line of lines) {
    minX = Math.min(minX, line.bbox.x);
    minY = Math.min(minY, line.bbox.y);
    maxX = Math.max(maxX, line.bbox.x + line.bbox.width);
    maxY = Math.max(maxY, line.bbox.y + line.bbox.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    page: first.page,
  };
}

function lineKey(line: Line): string {
  return `${line.bbox.page}:${Math.round(line.bbox.y)}:${line.text}`;
}
