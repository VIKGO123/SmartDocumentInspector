import type { Block } from "@/lib/types";
import { SCHEMAS, type DocumentSchema } from "./schemas";

export function classifyDocument(
  filename: string,
  rawText: string,
  blocks: Block[],
): DocumentSchema {
  const hay = `${filename} ${rawText} ${blocks
    .filter((b) => b.type === "heading")
    .map((b) => b.text)
    .join(" ")}`.toLowerCase();

  let best: { schema: DocumentSchema; score: number } = {
    schema: schemaGeneric(),
    score: 0,
  };
  for (const schema of SCHEMAS) {
    if (schema.id === "generic") continue;
    let score = 0;
    for (const hint of schema.hints) {
      if (hay.includes(hint)) score += hint.length > 8 ? 2 : 1;
    }
    if (score > best.score) best = { schema, score };
  }
  return best.score >= 2 ? best.schema : schemaGeneric();
}

function schemaGeneric(): DocumentSchema {
  return SCHEMAS.find((s) => s.id === "generic")!;
}
