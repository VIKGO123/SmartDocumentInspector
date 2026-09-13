import type { DocumentRecord, FieldRecord, QualityReport } from "@/lib/types";
import { schemaById } from "../schemas";
import { partitionDocumentContent } from "./partitionContent";

/**
 * Known timezone abbreviations that the local extractor sometimes
 * misclassifies as location values (e.g. "IST" from "17:46:06 IST").
 */
const TIMEZONE_CODES = new Set([
  "ist", "pst", "est", "cst", "mst", "gmt", "utc", "bst",
  "aest", "hst", "jst", "cet", "eet", "wat", "eat",
]);

/**
 * Returns true for fields that are known local-extraction false positives
 * and should be hidden from output:
 *  - timezone codes stored as location values
 *  - location/text values that are just trailing punctuation fragments
 *    (e.g. "Management," — a line that got split mid-sentence)
 *  - any value that is a lone special char / single word trailing comma
 */
function isNoiseField(f: FieldRecord): boolean {
  const val = f.value.trim();
  if (!val) return false;
  const normVal = val.toLowerCase();

  // Timezone code stored as location
  if (f.valueType === "location" && TIMEZONE_CODES.has(normVal)) return true;

  // Very short location (3 chars or less) — almost certainly noise
  if (f.valueType === "location" && val.length <= 3) return true;

  // Value ends with a lone comma/punctuation and is short — fragment noise
  if (/^[^,]{1,30},$/.test(val)) return true;

  return false;
}

export interface PapersnapField {
  key: string;
  label: string;
  value: string;
  confidence: number;
}

export interface PapersnapJson {
  documentId: string;
  docType: string;
  confidence: number;
  pageCount: number;
  fields: PapersnapField[];
  lineItems: unknown[];
  tables: { cells: string[][] }[];
  notes: string[];
  quality: QualityReport;
}

export function toPapersnapJson(
  document: DocumentRecord,
  fields: FieldRecord[],
): PapersnapJson {
  const order = schemaById(document?.schemaId ?? "generic").fields.map((f) => f.key);
  const { fields: named, notes } = partitionDocumentContent(
    fields ?? [],
    document?.blockTree ?? [],
    document?.notes ?? [],
  );
  const sorted = [...named].sort((a, b) => {
    const ai = order.indexOf(a.schemaKey ?? "");
    const bi = order.indexOf(b.schemaKey ?? "");
    if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Step 1: Remove known noise fields (timezone codes, trailing-comma fragments…)
  const cleaned = sorted.filter((f) => f.value?.trim() ? !isNoiseField(f) : true);

  // Step 2: Collapse fields with identical OR containment-related values.
  // Priority: no numbered suffix > higher confidence.
  // Containment rule: if field A's value is a proper substring of field B's value
  // (min 4 chars, ≥40% of longer), keep the LONGER value — it's more complete.
  const valueMap = new Map<string, FieldRecord>();
  for (const f of cleaned) {
    if (!f.value?.trim()) continue;
    const normVal = f.value.trim().toLowerCase().replace(/\s+/g, " ");
    const existing = valueMap.get(normVal);
    if (!existing) {
      valueMap.set(normVal, f);
    } else {
      const existingNumbered = /\(\d+\)$/.test(existing.key);
      const fNumbered = /\(\d+\)$/.test(f.key);
      if (existingNumbered && !fNumbered) {
        valueMap.set(normVal, f);
      } else if (!existingNumbered && fNumbered) {
        // keep existing
      } else if (f.confidence > existing.confidence) {
        valueMap.set(normVal, f);
      }
    }
  }

  // Step 3: Resolve containment duplicates — e.g. "25/06/2025" ⊂ "25/06/2025 17:46:06 IST".
  // When one winner value is a substring of another winner value, remove the shorter one.
  const winners = [...valueMap.values()];
  const suppressedIds = new Set<string>();
  for (const a of winners) {
    if (suppressedIds.has(a.id)) continue;
    const aNorm = a.value.trim().toLowerCase().replace(/\s+/g, " ");
    for (const b of winners) {
      if (a.id === b.id || suppressedIds.has(b.id)) continue;
      const bNorm = b.value.trim().toLowerCase().replace(/\s+/g, " ");
      // a's value is a substring of b's value → suppress a (b is more complete)
      if (
        bNorm.includes(aNorm) &&
        aNorm.length >= 4 &&
        aNorm.length / bNorm.length >= 0.4
      ) {
        suppressedIds.add(a.id);
        break;
      }
    }
  }

  const shown = cleaned.filter((f) => {
    if (!f.value?.trim()) return true;
    const normVal = f.value.trim().toLowerCase().replace(/\s+/g, " ");
    const winner = valueMap.get(normVal);
    return winner?.id === f.id && !suppressedIds.has(f.id);
  });
  const avg =
    shown.length === 0
      ? 0
      : Math.round(
          (shown.reduce((s, f) => s + f.confidence, 0) / shown.length) * 100,
        );
  const tables = document.blockTree
    .filter((b) => b.type === "table" && b.cells)
    .map((b) => ({ cells: b.cells ?? [] }));

  const edited = fields.filter((f) => f.edited).length;
  const flagged = fields.filter((f) => f.flagged).length;

  const quality: QualityReport = document.quality ?? {
    extractionConfidence: avg,
    pageLegibility: document.textSource === "ocr" ? 70 : 100,
    textSource: document.textSource ?? "digital",
    handwritingPct: document.textSource === "ocr" ? 10 : 0,
    checks: { line_arithmetic: "n/a", arithmetic: "n/a" },
    checksPassed: 0,
    checksTotal: 0,
    advice: [],
    userInput: {
      edited,
      flagged,
      rescans: document.rescans ?? 0,
    },
  };

  return {
    documentId: document.id,
    docType: document.schemaId === "generic" ? "other" : (document.schemaId ?? "other"),
    confidence: avg,
    pageCount: document.pageCount ?? 1,
    fields: shown.map((f) => ({
      key: slug(f.key.replace(/\s*\(\d+\)$/g, "").trim()),
      label: f.key.replace(/\s*\(\d+\)$/g, "").trim(),
      value: f.value,
      confidence: Math.round(f.confidence * 100),
    })),
    lineItems: [],
    tables,
    notes,
    quality: {
      ...quality,
      extractionConfidence: avg,
      userInput: { edited, flagged, rescans: document.rescans ?? 0 },
    },
  };
}

export function downloadJson(payload: unknown, filename: string, ext = ".json") {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, filename.replace(/\.[^.]+$/, "") + ext);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export {
  toPapersnapCsv,
  downloadCsv,
  toPapersnapExcelBlob,
  downloadExcel,
} from "./export";
