import type { Block } from "@/lib/types";

export interface ReconstructedBlock {
  id: string;
  page: number;
  type: string;
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export function buildExtractionPrompt(blocks: (Block | ReconstructedBlock)[]): string {
  const blockLines = blocks
    .map(
      (b) =>
        `[block id=${b.id} page=${"page" in b ? b.page : b.bbox.page} type=${b.type}]\n${b.text}`,
    )
    .join("\n\n");

  return `You are extracting structured data from a document that has already been
segmented into layout blocks (headers, paragraphs, tables, key-value pairs).

Rules:
1. Do NOT force the content into a predefined document category. Decide "documentType"
   yourself, in your own words, based on what you actually see.
2. Group related blocks into logical sections (e.g. a resume's separate jobs, an
   invoice's header vs. line items, a contract's clauses). Preserve that grouping —
   never merge multiple distinct entries (e.g. two different jobs, two different
   invoice line items) into one flat list of bullets.
3. Use whatever field labels are actually present in the document (in the document's
   own language/wording where possible). Do not invent labels that aren't supported
   by the text.
4. If a block looks corrupted, truncated, or ambiguous (e.g. a name that appears to
   be cut off mid-word), extract it as-is and set a low confidence rather than
   guessing or "fixing" it.
5. Every field's "confidence" should reflect YOUR actual certainty for that specific
   value, not a flat default. A clearly-formatted email should score higher than an
   inferred specialization line.

Document blocks:
${blockLines}
`;
}
