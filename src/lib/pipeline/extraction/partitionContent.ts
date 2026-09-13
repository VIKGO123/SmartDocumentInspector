import type { Block, FieldRecord } from "@/lib/types";

const SECTION_HEADING =
  /^(professional summary|key highlights|technical skills|professional experience|education|certifications|languages|work experience|skills|summary)$/i;

const GENERIC_LABEL =
  /^(person|org|amount|date|url|id|email|phone|table)( \(\d+\))?$/i;

const TYPED_NAMES = new Set([
  "email",
  "phone",
  "url",
  "date",
  "money",
  "currency",
  "id",
  "location",
]);

export function hasClassifiedName(field: Pick<FieldRecord, "schemaKey" | "key" | "value" | "valueType">): boolean {
  if (!field?.value?.trim()) return false;
  if (field.schemaKey) return true;
  if (field.valueType === "table") return false;
  if (field.value.trim().length > 180) return false;
  const label = (field.key ?? "").trim();
  if (!label) return false;
  if (TYPED_NAMES.has(field.valueType)) return true;
  if (GENERIC_LABEL.test(label)) return false;
  return true;
}

export function partitionDocumentContent(
  fields: FieldRecord[] = [],
  blocks: Block[] = [],
  existingNotes: string[] = [],
): { fields: FieldRecord[]; notes: string[] } {
  const safeFields = Array.isArray(fields) ? fields : [];
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const safeNotes = Array.isArray(existingNotes) ? existingNotes : [];

  const named = safeFields.filter((f) => hasClassifiedName(f));
  const unnamedValues = safeFields
    .filter((f) => f && f.value && f.value.trim() && !hasClassifiedName(f) && f.valueType !== "table")
    .map((f) => f.value.trim());

  const tableNotes = safeBlocks
    .filter((b) => b && b.type === "table" && b.cells?.length)
    .map((b) => (b.cells ?? []).map((row) => row.join(" | ")).join(" · "));

  const leftover = safeBlocks
    .filter((b) => b && b.type !== "figure" && b.type !== "table" && typeof b.text === "string")
    .map((b) => (b.text ?? "").replace(/^[-*•]\s*/, "").replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 24)
    .filter((text) => !SECTION_HEADING.test(text))
    .filter((text) => /^[A-Z0-9]/.test(text))
    .filter((text) => !coveredBy(text, [...named.map((f) => f.value), ...safeNotes]));

  const notes = uniqueNotes([
    ...safeNotes,
    ...unnamedValues,
    ...tableNotes,
    ...leftover,
  ]);

  return { fields: named, notes };
}

function coveredBy(text: string, values: string[]): boolean {
  const n = normalize(text);
  return values.some((value) => {
    const v = normalize(value);
    if (!v) return false;
    if (n === v) return true;
    if (n.length >= 12 && v.includes(n)) return true;
    if (v.length >= 12 && n.includes(v)) return true;
    return false;
  });
}

function normalize(text: string): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueNotes(notes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of notes) {
    if (!note) continue;
    const k = normalize(note).slice(0, 96);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(note);
  }
  return out.slice(0, 40);
}
