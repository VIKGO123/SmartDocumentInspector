import { z } from "zod";
import type { FieldValueType } from "@/lib/types";

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g;
export const MONEY_RE = /(?:USD|EUR|GBP|\$|£|€)\s?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|-?\d{1,3}(?:,\d{3})*\.\d{2}/g;
export const DATE_RE =
  /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/gi;
export const URL_RE = /https?:\/\/[^\s)]+/gi;
export const ID_RE =
  /\b(?:INV|PO|ID|SSN|EIN)[-#:\s]*[A-Z0-9-]{4,}\b|\b[A-Z]{2,}\d{5,}\b/g;

export interface PatternHit {
  valueType: FieldValueType;
  value: string;
  key: string;
}

export function extractPatterns(text: string): PatternHit[] {
  const hits: PatternHit[] = [];
  const push = (valueType: FieldValueType, key: string, re: RegExp) => {
    const matches = text.match(re) ?? [];
    const seen = new Set<string>();
    matches.forEach((value, i) => {
      const v = value.trim();
      if (seen.has(v.toLowerCase())) return;
      seen.add(v.toLowerCase());
      hits.push({ valueType, value: v, key: i === 0 ? key : `${key} (${i + 1})` });
    });
  };
  push("email", "Email", EMAIL_RE);
  push("phone", "Phone", PHONE_RE);
  push("money", "Amount", MONEY_RE);
  push("date", "Date", DATE_RE);
  push("url", "URL", URL_RE);
  push("id", "ID", ID_RE);
  return hits;
}

export const fieldSchemas: Record<FieldValueType, z.ZodType<string>> = {
  email: z.string().email(),
  phone: z.string().regex(/^[+\d().\s-]{7,}$/),
  money: z.string().regex(/^[$\u00a3\u20ac]?-?[\d,]+(?:\.\d{2})?(?:\s?(?:USD|EUR|GBP))?$/i),
  date: z.string().min(4),
  url: z.string().url(),
  id: z.string().min(2),
  person: z.string().min(1),
  org: z.string().min(1),
  location: z.string().min(1),
  table: z.string().min(1),
  text: z.string().min(1),
};

export function validateFieldValue(type: FieldValueType, value: string): boolean {
  const parsed = fieldSchemas[type].safeParse(value.trim());
  return parsed.success;
}
