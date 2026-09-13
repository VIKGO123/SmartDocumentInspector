import type { Block, FieldRecord } from "@/lib/types";
import type { DocumentSchema, FieldDefinition } from "../schemas";
import { applyInferredLabels } from "./inferLabel";

type Candidate = Omit<FieldRecord, "confidence" | "tier">;

export function bindToSchema(
  schema: DocumentSchema,
  candidates: Candidate[],
  blocks: Block[],
): Candidate[] {
  const remaining = [...candidates];
  const bound: Candidate[] = [];
  const used = new Set<string>();

  for (const def of schema.fields) {
    const preset = remaining.find((c) => !used.has(c.id) && c.schemaKey === def.key);
    if (preset) {
      used.add(preset.id);
      bound.push({
        ...preset,
        schemaKey: def.key,
        required: def.required,
        note: def.note,
        semanticFit: 0.95,
        valueType: def.valueType,
        missing: !preset.value.trim(),
      });
      continue;
    }
    const ranked = remaining
      .filter((c) => !used.has(c.id) && typesCompatible(def, c))
      .map((c) => ({
        candidate: c,
        fit: scoreFit(def, c, blocks),
      }))
      .sort((a, b) => b.fit - a.fit);

    const top = ranked[0];
    if (top && top.fit >= 0.28) {
      used.add(top.candidate.id);
      bound.push({
        ...top.candidate,
        schemaKey: def.key,
        required: def.required,
        note: def.note,
        semanticFit: top.fit,
        valueType: def.valueType,
        missing: !top.candidate.value.trim(),
      });
      continue;
    }

    if (def.required || def.valueType === "money" || def.valueType === "date") {
      const fallback = fallbackByType(def, remaining, used);
      if (fallback) {
        used.add(fallback.id);
        bound.push({
          ...fallback,
          schemaKey: def.key,
          required: def.required,
          note: def.note,
          semanticFit: 0.3,
          valueType: def.valueType,
          missing: !fallback.value.trim(),
        });
        continue;
      }
    }

    if (def.required) {
      bound.push({
        id: crypto.randomUUID(),
        documentId: candidates[0]?.documentId ?? "",
        key: def.label,
        value: "",
        valueType: def.valueType,
        bbox: blocks[0]?.bbox ?? { x: 0, y: 0, width: 0, height: 0, page: 1 },
        sourceBlockId: "",
        edited: false,
        editHistory: [],
        schemaKey: def.key,
        required: true,
        note: def.note,
        missing: true,
        semanticFit: 0,
      });
    }
  }

  for (const extra of remaining.filter((c) => !used.has(c.id))) {
    bound.push({ ...extra, schemaKey: extra.schemaKey, required: false });
  }
  return applyInferredLabels(deduplicateByValue(bound), blocks);
}

/**
 * Collapse candidates whose values are identical (after normalisation) into a
 * single canonical field, choosing the best representative:
 *   1. Schema-bound fields (schemaKey set) win unconditionally.
 *   2. Among non-schema fields, prefer a typed valueType (email, phone…)
 *      over the generic "text" / catch-all label.
 *   3. Break remaining ties by keeping the first (higher-ranked) candidate.
 *
 * This runs BEFORE applyInferredLabels so label-numbering (which produces
 * "Email (2)", "Phone (3)") never sees duplicate values in the first place.
 */
function deduplicateByValue(candidates: Candidate[]): Candidate[] {
  const normVal = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

  function specificity(c: Candidate): number {
    if (c.schemaKey) return 100;           // schema-bound: always wins
    if (c.valueType !== "text") return 10; // typed (email, phone, location…)
    return 0;                              // generic text / catch-all
  }

  const seen = new Map<string, Candidate>();
  for (const c of candidates) {
    if (!c.value.trim()) continue; // keep empty / missing required placeholders as-is
    const key = normVal(c.value);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
    } else if (specificity(c) > specificity(existing)) {
      seen.set(key, c); // replace with more specific candidate
    }
  }

  // Preserve original order; only keep the winner for each value group.
  const kept = new Set(seen.values());
  return candidates.filter((c) => !c.value.trim() || kept.has(c));
}

function typesCompatible(def: FieldDefinition, candidate: Candidate): boolean {
  if (candidate.valueType === def.valueType) return true;
  if (def.valueType === "text") return true;
  if (def.valueType === "org" && candidate.valueType === "text") return true;
  if (def.valueType === "money" && /[\d$£€]/.test(candidate.value)) return true;
  return false;
}

function scoreFit(def: FieldDefinition, candidate: Candidate, blocks: Block[]): number {
  const block = blocks.find((b) => b.id === candidate.sourceBlockId);
  const context = `${candidate.key} ${block?.text ?? ""}`;
  const alias = Math.max(
    aliasScore(candidate.key, def.aliases),
    aliasScore(context, def.aliases),
    aliasScore(def.key.replace(/_/g, " "), def.aliases) * 0.2,
  );
  let typeBonus = candidate.valueType === def.valueType ? 0.2 : 0;
  if (def.key === "total_due" || def.key === "total_paid") {
    typeBonus += moneyMagnitudeBonus(candidate);
  }
  if (def.key === "due_date" && /due|pay by/i.test(context)) typeBonus += 0.25;
  if (def.key === "invoice_date" && /due/i.test(context)) typeBonus -= 0.2;
  if (def.key === "subtotal" && /total due|grand total|amount due/i.test(context)) {
    typeBonus -= 0.4;
  }
  return Math.max(0, Math.min(1, alias * 0.7 + typeBonus));
}

function aliasScore(text: string, aliases: string[]): number {
  const n = normalize(text);
  let best = 0;
  for (const alias of aliases) {
    const a = normalize(alias);
    if (!a) continue;
    if (n === a) best = Math.max(best, 1);
    else if (n.includes(a) || a.includes(n)) best = Math.max(best, 0.8);
  }
  return best;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function moneyMagnitudeBonus(candidate: Candidate): number {
  const n = parseMoney(candidate.value);
  if (n == null) return 0;
  return Math.min(0.15, n / 100000);
}

function parseMoney(value: string): number | null {
  const n = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fallbackByType(
  def: FieldDefinition,
  remaining: Candidate[],
  used: Set<string>,
): Candidate | undefined {
  const pool = remaining.filter((c) => !used.has(c.id) && c.valueType === def.valueType);
  if (!pool.length) return undefined;
  if (def.valueType === "money") {
    return [...pool].sort(
      (a, b) => (parseMoney(b.value) ?? 0) - (parseMoney(a.value) ?? 0),
    )[0];
  }
  return pool[0];
}
