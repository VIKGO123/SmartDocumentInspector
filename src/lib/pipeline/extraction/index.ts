import type { Block, FieldRecord } from "@/lib/types";
import { extractEntities } from "./ner";
import { extractPatterns } from "./patterns";
import { locateInBlocks } from "./locate";
import { isCueLabel } from "./inferLabel";

export function extractFields(documentId: string, blocks: Block[]): Omit<FieldRecord, "confidence" | "tier">[] {
  const text = blocks.map((b) => b.text).join("\n");
  const hits = [...extractPatterns(text), ...extractEntities(text)];
  const fields: Omit<FieldRecord, "confidence" | "tier">[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    const key = `${hit.valueType}:${hit.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const located = locateInBlocks(blocks, hit.value);
    fields.push({
      id: crypto.randomUUID(),
      documentId,
      key: hit.key,
      value: hit.value,
      valueType: hit.valueType,
      bbox: located?.bbox ?? blocks[0]?.bbox ?? { x: 0, y: 0, width: 0, height: 0, page: 1 },
      sourceBlockId: located?.id ?? blocks[0]?.id ?? "",
      edited: false,
      editHistory: [],
    });
  }

  for (const block of blocks) {
    if (block.type === "keyValue") {
      const parts = block.text.split(/[:–—]/);
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join(":").trim();
        const k = `text:${key.toLowerCase()}:${value.toLowerCase()}`;
        if (value && !seen.has(k)) {
          seen.add(k);
          fields.push({
            id: crypto.randomUUID(),
            documentId,
            key: isCueLabel(key, value) ? key : "Field",
            value,
            valueType: "text",
            bbox: block.bbox,
            sourceBlockId: block.id,
            edited: false,
            editHistory: [],
          });
        }
      }
    }
    if (block.type === "table" && block.cells) {
      fields.push({
        id: crypto.randomUUID(),
        documentId,
        key: "Table",
        value: `${block.cells.length} rows × ${block.cells[0]?.length ?? 0}`,
        valueType: "table",
        bbox: block.bbox,
        sourceBlockId: block.id,
        edited: false,
        editHistory: [],
      });
    }
  }

  return fields;
}
