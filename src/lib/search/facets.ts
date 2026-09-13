import type { FieldRecord, FieldValueType } from "@/lib/types";

export interface Facet {
  valueType: FieldValueType;
  label: string;
  count: number;
}

const LABELS: Partial<Record<FieldValueType, string>> = {
  date: "Dates",
  money: "Amounts",
  email: "Emails",
  phone: "Phones",
  org: "Orgs",
  person: "People",
  location: "Locations",
  table: "Tables",
  url: "URLs",
  id: "IDs",
  text: "Free text",
};

export function deriveFacets(fields: FieldRecord[], documentIds?: Set<string>): Facet[] {
  const counts = new Map<FieldValueType, number>();
  for (const field of fields) {
    if (documentIds && !documentIds.has(field.documentId)) continue;
    counts.set(field.valueType, (counts.get(field.valueType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([valueType, count]) => ({
      valueType,
      count,
      label: LABELS[valueType] ?? valueType,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function parseDateValue(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
