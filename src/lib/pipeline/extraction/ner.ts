import nlp from "compromise";
import type { FieldValueType } from "@/lib/types";
import type { PatternHit } from "./patterns";

export function extractEntities(text: string): PatternHit[] {
  const doc = nlp(text);
  const hits: PatternHit[] = [];
  const add = (valueType: FieldValueType, key: string, values: string[]) => {
    const seen = new Set<string>();
    values.forEach((value, i) => {
      const v = value.trim();
      if (v.length < 2 || seen.has(v.toLowerCase())) return;
      seen.add(v.toLowerCase());
      hits.push({
        valueType,
        value: v,
        key: i === 0 ? key : `${key} (${i + 1})`,
      });
    });
  };
  add("person", "Person", doc.people().out("array") as string[]);
  add("org", "Org", doc.organizations().out("array") as string[]);
  add("location", "Location", doc.places().out("array") as string[]);
  return hits;
}
