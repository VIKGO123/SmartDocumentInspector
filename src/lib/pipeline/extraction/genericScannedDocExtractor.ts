/**
 * genericScannedDocExtractor.ts
 *
 * Generic, category-agnostic scanned document field extractor.
 * Uses a registry of composable structural recognizers (key-value lines,
 * emails, URLs, dates, phone numbers, currencies, grouped digit IDs,
 * categorical values, and postal codes).
 */

export interface ExtractedField {
  label: string;
  value: string;
  valueType?: "text" | "date" | "currency" | "email" | "phone" | "url" | "id";
  confidence?: number;
}

export interface FieldRecognizer {
  name: string;
  recognize(text: string): ExtractedField[];
}

// ---------- Generic structural recognizers ----------

/**
 * Key-value line recognizer: matches "Label: Value", "Label - Value",
 * or column whitespace gaps.
 */
const keyValueLineRecognizer: FieldRecognizer = {
  name: "key-value-line",
  recognize(text: string) {
    const fields: ExtractedField[] = [];
    const lines = text.split("\n");
    const pattern = /^([A-Za-z][A-Za-z /.]{1,40}?)\s*(?::|-|\s{2,})\s*(.{1,120})$/;
    for (const line of lines) {
      const match = line.trim().match(pattern);
      if (!match) continue;
      const [, label, value] = match;
      if (value.trim().length === 0) continue;
      fields.push({ label: label.trim(), value: value.trim(), confidence: 0.6 });
    }
    return fields;
  },
};

const emailRecognizer: FieldRecognizer = {
  name: "email",
  recognize: (text: string) =>
    matchAll(text, /[^\s@]+@[^\s@]+\.[^\s@]+/g, "Email", "email"),
};

const urlRecognizer: FieldRecognizer = {
  name: "url",
  recognize: (text: string) =>
    matchAll(text, /https?:\/\/\S+/g, "URL", "url"),
};

const phoneRecognizer: FieldRecognizer = {
  name: "phone",
  recognize: (text: string) =>
    matchAll(text, /(?:\+?\d{1,3}[\s-]?)?\d{10}\b/g, "Phone", "phone"),
};

const dateRecognizer: FieldRecognizer = {
  name: "date",
  recognize: (text: string) =>
    matchAll(
      text,
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b[A-Za-z]{3,9}\s\d{1,2},?\s\d{4}\b/g,
      "Date",
      "date"
    ),
};

const currencyRecognizer: FieldRecognizer = {
  name: "currency",
  recognize: (text: string) =>
    matchAll(text, /[$₹€£]\s?[\d,]+(?:\.\d{1,2})?/g, "Amount", "currency"),
};

/**
 * Generic long grouped-digit sequence — covers Aadhaar, account,
 * policy, and reference numbers.
 */
const groupedDigitIdRecognizer: FieldRecognizer = {
  name: "grouped-digit-id",
  recognize: (text: string) =>
    matchAll(
      text,
      /\b\d{3,4}[\s-]\d{3,4}[\s-]\d{3,4}(?:[\s-]\d{3,4})?\b/g,
      "ID Number",
      "id"
    ),
};

/**
 * Configurable categorical-value recognizer.
 */
export function categoricalValueRecognizer(
  categories: Record<string, string[]> = {
    gender: ["Male", "Female", "Transgender", "Other"],
  }
): FieldRecognizer {
  return {
    name: "categorical-value",
    recognize(text: string) {
      const fields: ExtractedField[] = [];
      for (const [label, values] of Object.entries(categories)) {
        const pattern = new RegExp(`\\b(${values.join("|")})\\b`, "i");
        const match = text.match(pattern);
        if (match) {
          fields.push({
            label: capitalize(label),
            value: match[1],
            valueType: "text",
            confidence: 0.55,
          });
        }
      }
      return fields;
    },
  };
}

/**
 * Postal / PIN code recognizer.
 */
export function postalCodeRecognizer(
  patterns: RegExp[] = [/\b\d{6}\b/, /\b\d{5}(-\d{4})?\b/]
): FieldRecognizer {
  return {
    name: "postal-code",
    recognize(text: string) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match)
          return [
            {
              label: "Postal Code",
              value: match[0],
              valueType: "text",
              confidence: 0.5,
            },
          ];
      }
      return [];
    },
  };
}

// ---------- Helpers ----------

function matchAll(
  text: string,
  pattern: RegExp,
  label: string,
  valueType: ExtractedField["valueType"]
): ExtractedField[] {
  return [...text.matchAll(pattern)].map((m) => ({
    label,
    value: m[0].trim(),
    valueType,
    confidence: 0.75,
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Public entry point ----------

export const defaultRecognizers: FieldRecognizer[] = [
  keyValueLineRecognizer,
  emailRecognizer,
  urlRecognizer,
  phoneRecognizer,
  dateRecognizer,
  currencyRecognizer,
  groupedDigitIdRecognizer,
  categoricalValueRecognizer(),
  postalCodeRecognizer(),
];

export function extractGenericFields(
  text: string,
  recognizers: FieldRecognizer[] = defaultRecognizers
): ExtractedField[] {
  const all = recognizers.flatMap((r) => r.recognize(text));
  return dedupeOverlapping(all);
}

function dedupeOverlapping(fields: ExtractedField[]): ExtractedField[] {
  const labeled = fields.filter((f) => f.confidence === 0.6);
  const blind = fields.filter((f) => f.confidence !== 0.6);

  const survivingBlind = blind.filter(
    (b) => !labeled.some((l) => normalize(l.value) === normalize(b.value))
  );

  return [...labeled, ...survivingBlind];
}

function normalize(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}
