import type { BBox, Block, FieldRecord } from "@/lib/types";

export function locateInBlocks(blocks: Block[], value: string): Block | undefined {
  const needle = value.toLowerCase().trim();
  if (!needle) return undefined;
  return (
    blocks.find((b) => b.text.toLowerCase().includes(needle)) ??
    blocks.find((b) => needle.includes(b.text.toLowerCase()) && b.text.trim().length > 2)
  );
}

export function resolveTextBBox(text: string, blocks: Block[]): BBox | null {
  const block = locateInBlocks(blocks, text.slice(0, 96));
  if (!block || block.bbox.width < 2 || block.bbox.height < 2) return null;
  const pad = 3;
  return {
    x: Math.max(0, block.bbox.x - pad),
    y: Math.max(0, block.bbox.y - pad),
    width: Math.max(block.bbox.width + pad * 2, 24),
    height: Math.max(block.bbox.height + pad * 2, 12),
    page: block.bbox.page || 1,
  };
}

export function resolveFieldBBox(field: FieldRecord, blocks: Block[]): BBox {
  const fromBlocks = field.value ? locateInBlocks(blocks, field.value)?.bbox : undefined;
  const fallbackBBox: BBox = { x: 0, y: 0, width: 0, height: 0, page: 1 };
  const fromField = field.bbox ?? fallbackBBox;
  let pick = fromField;
  if (fromBlocks && fromBlocks.width > 2 && fromBlocks.height > 2) {
    pick = fromBlocks;
  }
  const pad = 3;
  return {
    x: Math.max(0, (pick?.x ?? 0) - pad),
    y: Math.max(0, (pick?.y ?? 0) - pad),
    width: Math.max((pick?.width ?? 0) + pad * 2, 24),
    height: Math.max((pick?.height ?? 0) + pad * 2, 12),
    page: pick?.page || fromField?.page || 1,
  };
}
