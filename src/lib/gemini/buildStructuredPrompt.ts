/**
 * buildStructuredPrompt.ts
 *
 * Formats layout blocks as a compressed tagged outline ([H1], [P], [Table], [KV])
 * with targeted few-shot exemplars to anchor Gemini toward specific, concept-accurate
 * labels rather than generic or borrowed heading words (e.g. "Frontend (6)").
 */

import type { Block } from "@/lib/types";

export interface ReconstructedBlock {
  id?: string;
  type: string;
  text: string;
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number; page?: number };
}

const TAG_BY_TYPE: Record<string, string> = {
  header: "H1",
  heading: "H1",
  paragraph: "P",
  table: "Table",
  "key-value": "KV",
  keyValue: "KV",
  listItem: "List",
  figure: "Figure",
};

export function buildCompressedOutline(
  blocks: (ReconstructedBlock | Block)[]
): string {
  return blocks
    .map((b) => {
      const tag = TAG_BY_TYPE[b.type] ?? "P";
      return `[${tag}] ${b.text}`;
    })
    .join("\n");
}

// Short, deliberately varied exemplars to show the model what a specific label looks like
// vs. a generic one, and that unrelated values near the same heading get their own labels.
export const FEW_SHOT_EXAMPLES = `
Example 1 (resume-shaped input):
[H1] JANE DOE
[P] Senior Backend Engineer | Distributed Systems, Go, Kubernetes
[KV] jane@example.com | +1 555-0100
[H1] EXPERIENCE
[P] Staff Engineer  Mar 2022 - Present
[P] Acme Corp - San Francisco, CA
Correct output includes separate fields: {label: "Name", value: "JANE DOE"},
{label: "Job Title", value: "Senior Backend Engineer"},
{label: "Specialization", value: "Distributed Systems, Go, Kubernetes"} —
NOT all three lumped under one label like "Backend" just because they sit
near the same heading.

Example 2 (invoice-shaped input):
[H1] INVOICE #4092
[KV] Date: 2024-01-15
[Table] Qty | Description | Price
[Table] 2 | Widget | $40.00
Correct output: a "Line Items" section with one entry per row, each
entry's own fields (Qty, Description, Price) — not one flattened bullet
per table row.

Example 3 (ID-document-shaped input):
[H1] GOVERNMENT OF EXAMPLESTAN
[KV] Name: John Smith
[KV] DOB: 01/01/1990
[KV] ID No: 1234 5678 9012
Correct output: distinct fields for Name, DOB, and ID No — never grouped
under a single generic label just because they're visually adjacent.
`;

export function buildExtractionPrompt(
  blocks: (ReconstructedBlock | Block)[]
): string {
  const outline = buildCompressedOutline(blocks);

  return `You are extracting structured data from a document already
segmented into layout blocks.

Rules:
1. Decide "documentType" yourself, in your own words — never force a
   predefined category.
2. Group related blocks into sections and entries that reflect the
   document's actual structure (see examples below).
3. EVERY field needs its own specific label drawn from what the document
   actually says near that value. Never reuse one label across values
   that aren't the same concept just because they're physically close to
   the same heading — see Example 1.
4. If a value has no clear label of its own, use "Unlabeled" rather than
   guessing a nearby heading's word. A visibly generic label is safer
   than a plausible-looking wrong one.
5. Table-like content becomes a section with one entry per row, not a
   flattened bullet list — see Example 2.
6. Confidence must reflect your real certainty for that specific value,
   not a flat default.

${FEW_SHOT_EXAMPLES}

Now extract from this document:
${outline}
`;
}
