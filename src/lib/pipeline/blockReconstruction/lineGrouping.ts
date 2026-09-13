import type { BBox, PositionedItem } from "@/lib/types";

export interface Line {
  text: string;
  items: PositionedItem[];
  bbox: BBox;
  fontSize: number;
}

export function groupLines(items: PositionedItem[]): Line[] {
  if (items.length === 0) return [];
  const byPage = new Map<number, PositionedItem[]>();
  for (const item of items) {
    const list = byPage.get(item.bbox.page) ?? [];
    list.push(item);
    byPage.set(item.bbox.page, list);
  }

  const lines: Line[] = [];
  for (const [, pageItems] of byPage) {
    const sorted = [...pageItems].sort((a, b) => {
      const dy = a.bbox.y - b.bbox.y;
      if (Math.abs(dy) > 2) return dy;
      return a.bbox.x - b.bbox.x;
    });
    const buckets: PositionedItem[][] = [];
    for (const item of sorted) {
      const midY = item.bbox.y + item.bbox.height / 2;
      const bucket = buckets.find((b) => {
        const sample = b[0];
        const sampleMid = sample.bbox.y + sample.bbox.height / 2;
        const threshold = Math.max(sample.bbox.height, item.bbox.height) * 0.6;
        return Math.abs(sampleMid - midY) < threshold;
      });
      if (bucket) bucket.push(item);
      else buckets.push([item]);
    }
    for (const bucket of buckets) {
      bucket.sort((a, b) => a.bbox.x - b.bbox.x);
      lines.push(lineFromItems(bucket));
    }
  }
  return lines.sort((a, b) =>
    a.bbox.page === b.bbox.page
      ? a.bbox.y - b.bbox.y
      : a.bbox.page - b.bbox.page,
  );
}

function lineFromItems(items: PositionedItem[]): Line {
  const first = items[0];
  let minX = first.bbox.x;
  let minY = first.bbox.y;
  let maxX = first.bbox.x + first.bbox.width;
  let maxY = first.bbox.y + first.bbox.height;
  let fontSum = 0;
  for (const item of items) {
    minX = Math.min(minX, item.bbox.x);
    minY = Math.min(minY, item.bbox.y);
    maxX = Math.max(maxX, item.bbox.x + item.bbox.width);
    maxY = Math.max(maxY, item.bbox.y + item.bbox.height);
    fontSum += item.fontSize ?? item.bbox.height;
  }
  return {
    text: items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim(),
    items,
    fontSize: fontSum / items.length,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      page: first.bbox.page,
    },
  };
}
