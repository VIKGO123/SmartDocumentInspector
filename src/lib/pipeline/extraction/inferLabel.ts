import type { Block, FieldRecord, FieldValueType, LabelProvenance } from "@/lib/types";

const TYPE_LABEL: Record<FieldValueType, string> = {
  email: "Email",
  phone: "Phone",
  url: "URL",
  date: "Date",
  money: "Amount",
  person: "Name",
  org: "Organization",
  location: "Location",
  id: "ID",
  text: "Field",
  table: "Table",
};

const TYPE_CUES: Partial<Record<FieldValueType, string[]>> = {
  email: ["e-mail", "email", "mail"],
  phone: ["phone", "mobile", "telephone", "tel", "cell"],
  url: ["linkedin", "github", "website", "portfolio", "url", "link"],
  date: ["date", "issued", "due"],
  money: ["total due", "amount due", "grand total", "subtotal", "total", "amount"],
  person: ["name", "candidate", "author"],
  org: ["vendor", "merchant", "company", "organization", "employer"],
  location: ["location", "address", "city"],
  id: ["invoice number", "invoice #", "inv", "id"],
  text: ["frontend", "backend", "tools", "skills", "title", "role"],
};

const ALLOWED_ONE_WORD = new Set(
  [
    ...Object.values(TYPE_LABEL),
    ...Object.values(TYPE_CUES).flat(),
    "frontend",
    "backend",
    "tools",
    "devops",
    "testing",
    "cloud",
    "skills",
    "education",
    "experience",
    "role",
    "title",
    "company",
  ]
    .flatMap((s) => s.split(/\s+/))
    .map((s) => s.toLowerCase()),
);

export interface InferredLabelDetails {
  key: string;
  provenance: LabelProvenance;
}

export function inferFieldLabelDetails(
  field: Pick<FieldRecord, "key" | "value" | "valueType" | "sourceBlockId"> & {
    schemaKey?: string;
  },
  blocks: Block[],
): InferredLabelDetails {
  // 1. If bound to a schema, preserve the schema-governed label
  if (field.schemaKey && field.key && field.key !== "Field") {
    return { key: tidyLabel(field.key), provenance: "schema" };
  }

  const value = field.value.trim();
  const blockIndex = blocks.findIndex((b) => b.id === field.sourceBlockId);
  const block = blockIndex >= 0 ? blocks[blockIndex] : undefined;
  const text = flatten(block?.text ?? "");

  // 2. Direct inline cue before colon or delimiter (e.g. "Amount due: $1,400", "Frontend: React")
  const explicitCue = explicitCueBeforeValue(text, value) ?? labeledPair(text, value);
  if (explicitCue && isCueLabel(explicitCue, value)) {
    return { key: tidyLabel(explicitCue), provenance: "explicit" };
  }

  // 3. If field already has a non-generic, specific valid label (e.g. from NER or key-value)
  const defaultTypeLabel = TYPE_LABEL[field.valueType] ?? "Field";
  if (
    field.key &&
    field.key !== "Field" &&
    field.key.toLowerCase() !== defaultTypeLabel.toLowerCase() &&
    isCueLabel(field.key, value)
  ) {
    return { key: tidyLabel(field.key), provenance: "explicit" };
  }

  // 4. Loose proximity cue anywhere in block text (e.g. "Skills" or "Frontend" or "Location")
  const nearby = cueWordInText(text, field.valueType);
  if (nearby) {
    return { key: nearby, provenance: "inferred" };
  }

  // 5. Existing cue label if valid and not generic placeholder
  if (field.key && field.key.toLowerCase() !== "field" && isCueLabel(field.key, value)) {
    return { key: tidyLabel(field.key), provenance: "explicit" };
  }

  // 6. Fallback to type name
  return { key: defaultTypeLabel, provenance: "inferred" };
}

export function inferFieldLabel(
  field: Pick<FieldRecord, "key" | "value" | "valueType" | "sourceBlockId"> & {
    schemaKey?: string;
  },
  blocks: Block[],
): string {
  return inferFieldLabelDetails(field, blocks).key;
}

export function applyInferredLabels<
  T extends Pick<FieldRecord, "key" | "value" | "valueType" | "sourceBlockId"> & {
    schemaKey?: string;
    labelProvenance?: LabelProvenance;
  }
>(
  fields: T[],
  blocks: Block[],
): (T & { labelProvenance: LabelProvenance })[] {
  const used = new Set<string>();
  const consumedBlockProximityCues = new Set<string>();

  return fields.map((field) => {
    const details = inferFieldLabelDetails(field, blocks);
    let key = details.key;
    const provenance = details.provenance;

    // Prevent loose proximity cues from stampeding over multiple fields in the same block
    if (provenance === "inferred" && field.sourceBlockId) {
      const cueKey = `${field.sourceBlockId}:${key.toLowerCase()}`;
      if (consumedBlockProximityCues.has(cueKey)) {
        // Fall back to clean type label rather than creating "Frontend (2)", "Frontend (3)"
        key = TYPE_LABEL[field.valueType] ?? "Field";
      } else {
        consumedBlockProximityCues.add(cueKey);
      }
    }

    const base = key;
    let n = 2;
    while (used.has(key.toLowerCase())) {
      key = `${base} (${n})`;
      n += 1;
    }
    used.add(key.toLowerCase());

    return {
      ...field,
      key,
      labelProvenance: provenance,
    };
  });
}

function explicitCueBeforeValue(text: string, value: string): string | null {
  if (!text || !value) return null;
  const idx = text.toLowerCase().indexOf(value.toLowerCase());
  if (idx <= 0) return null;
  const rawPrefix = text.slice(0, idx);
  // Must end with a cue delimiter like ':', '–', '—', '-', '|', '•', ';'
  if (!/[:|–—\-•·,;/]\s*$/.test(rawPrefix)) return null;
  const prefix = lastCue(rawPrefix);
  return isCueLabel(prefix, value) ? prefix : null;
}


function labeledPair(text: string, value: string): string | null {
  const parts = text.split(/\s*[:–—]\s*/);
  if (parts.length < 2) return null;
  const label = flatten(parts[0]);
  const rest = parts.slice(1).join(": ");
  if (!rest.toLowerCase().includes(value.toLowerCase())) return null;
  return isCueLabel(label, value) ? label : null;
}

function cueWordInText(text: string, valueType: FieldValueType): string | null {
  const hay = flatten(text);
  if (!hay) return null;
  const cues = [...(TYPE_CUES[valueType] ?? [])].sort((a, b) => b.length - a.length);
  for (const cue of cues) {
    const re = new RegExp(`\\b${escapeRegExp(cue)}\\b`, "i");
    const match = hay.match(re);
    if (match?.[0]) return tidyLabel(match[0].replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return null;
}

function lastCue(prefix: string): string {
  const cleaned = prefix.replace(/[\s|:–—\-•·,;/]+$/g, "").trim();
  const chunks = cleaned.split(/\s*[|•·]\s*/).map((c) => c.trim()).filter(Boolean);
  return chunks[chunks.length - 1] ?? cleaned;
}

const TRAILING_STOPWORDS = new Set([
  "in", "at", "on", "for", "with", "by", "of", "to", "from", "and", "or", "as", "the", "a", "an", "is", "are"
]);

export function isCueLabel(label: string, value: string): boolean {
  const l = flatten(label);
  if (l.length < 2 || l.length > 32) return false;
  const words = l.split(/\s+/);
  if (words.length > 4) return false;
  const lastWord = words[words.length - 1]?.toLowerCase();
  if (lastWord && TRAILING_STOPWORDS.has(lastWord)) return false;
  if (almostEqual(l, value)) return false;
  if (value.toLowerCase().includes(l.toLowerCase()) && l.length > 12) return false;
  if (/^https?:/i.test(l) || l.includes("@") || /[$\u00a3\u20ac]/.test(l)) return false;
  if (/^\+?\d[\d\s.-]{5,}$/.test(l)) return false;
  if (/\b(19|20)\d{2}\b/.test(l)) return false;
  if (looksLikeLocation(l) || looksLikePersonName(l)) return false;
  if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(l)) return false;
  if (/engineer|developer|intern|associate|analyst|university|college/i.test(l) && words.length > 1) {
    return false;
  }
  if (words.length === 1 && /^[A-Z]/.test(l) && !ALLOWED_ONE_WORD.has(l.toLowerCase())) {
    return false;
  }
  return true;
}

function looksLikePersonName(text: string): boolean {
  return /^[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){1,3}$/.test(text) && text.length < 48;
}

function looksLikeLocation(text: string): boolean {
  return /,\s*(india|usa|uk|united states|united kingdom|[A-Z]{2})\b/i.test(text);
}

function almostEqual(a: string, b: string): boolean {
  return flatten(a).toLowerCase() === flatten(b).toLowerCase();
}

function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function tidyLabel(text: string): string {
  return flatten(text).replace(/[:|–—\-•·]+$/g, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
