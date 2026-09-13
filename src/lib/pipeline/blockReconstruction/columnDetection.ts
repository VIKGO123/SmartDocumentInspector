import type { Line } from "./lineGrouping";

export interface Column {
  index: number;
  lines: Line[];
}

export function detectColumns(lines: Line[]): Column[] {
  if (lines.length === 0) return [];
  const byPage = new Map<number, Line[]>();
  for (const line of lines) {
    const list = byPage.get(line.bbox.page) ?? [];
    list.push(line);
    byPage.set(line.bbox.page, list);
  }

  const columns: Column[] = [];
  let colIndex = 0;
  for (const [, pageLines] of byPage) {
    const pageWidth = Math.max(
      ...pageLines.map((l) => l.bbox.x + l.bbox.width),
      1,
    );
    const mids = pageLines.map((l) => l.bbox.x + l.bbox.width / 2);
    const gap = findLargestGap(mids.sort((a, b) => a - b), pageWidth);
    if (gap) {
      const left: Line[] = [];
      const right: Line[] = [];
      for (const line of pageLines) {
        const mid = line.bbox.x + line.bbox.width / 2;
        if (mid < gap.splitAt) left.push(line);
        else right.push(line);
      }
      if (left.length && right.length) {
        columns.push({ index: colIndex++, lines: left });
        columns.push({ index: colIndex++, lines: right });
        continue;
      }
    }
    columns.push({ index: colIndex++, lines: pageLines });
  }
  return columns;
}

function findLargestGap(
  mids: number[],
  pageWidth: number,
): { splitAt: number } | null {
  if (mids.length < 6) return null;
  let best = 0;
  let splitAt = 0;
  for (let i = 1; i < mids.length; i += 1) {
    const gap = mids[i] - mids[i - 1];
    if (gap > best) {
      best = gap;
      splitAt = (mids[i] + mids[i - 1]) / 2;
    }
  }
  if (best < pageWidth * 0.12) return null;
  if (splitAt < pageWidth * 0.25 || splitAt > pageWidth * 0.75) return null;
  return { splitAt };
}

export function readingOrder(columns: Column[]): Line[] {
  const ordered: Line[] = [];
  for (const col of columns.sort((a, b) => a.index - b.index)) {
    ordered.push(
      ...[...col.lines].sort((a, b) =>
        a.bbox.page === b.bbox.page
          ? a.bbox.y - b.bbox.y
          : a.bbox.page - b.bbox.page,
      ),
    );
  }
  return ordered;
}
