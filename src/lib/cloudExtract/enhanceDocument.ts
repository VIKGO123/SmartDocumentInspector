import { documentsRepo } from "@/lib/storage/documentsRepo";
import { fieldsRepo } from "@/lib/storage/fieldsRepo";
import { auditRepo } from "@/lib/storage/auditRepo";
import { computeGrounding } from "./grounding";
import { patternStrength, scoreField } from "@/lib/pipeline/confidence";
import type { DocumentRecord, FieldRecord } from "@/lib/types";

interface AiField {
  label?: string;
  key?: string;
  value?: string;
  valueType?: string;
  confidence?: number;
  sourceBlockIds?: string[];
}

interface AiSection {
  sectionTitle?: string;
  entries?: Array<{
    fields?: AiField[];
  }>;
}

export interface EnhanceResult {
  success: boolean;
  sectionsCount: number;
  newFieldsCount: number;
  documentType?: string;
  error?: string;
}

function normalizeValue(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildValueIndex(fields: FieldRecord[]): Map<string, FieldRecord> {
  const index = new Map<string, FieldRecord>();
  for (const f of fields) {
    if (f.value?.trim()) {
      const norm = normalizeValue(f.value);
      if (!index.has(norm)) index.set(norm, f);
    }
  }
  return index;
}

/**
 * Find a local field whose value has a containment relationship with the AI value:
 *
 *   "ai-contained-in-local"  → local field has a noisier/concatenated value that
 *                              CONTAINS the AI value (e.g. local = "101603377 Roll Number : 101603377",
 *                              AI = "101603377"). Use the AI's cleaner value + label.
 *
 *   "local-contained-in-ai"  → AI value is the more complete version
 *                              (e.g. local = "Thapar Institute",
 *                              AI = "Thapar Institute of Engineering and Technology, Patiala").
 *                              Upgrade local to AI's full value + label.
 *
 * Minimum match length: 4 chars to avoid accidental single-word collisions.
 * The contained portion must be at least 40% of the longer string to avoid
 * spurious matches.
 */
function findContainmentMatch(
  aiNormVal: string,
  valueIndex: Map<string, FieldRecord>,
): { field: FieldRecord; matchType: "ai-contained-in-local" | "local-contained-in-ai" } | null {
  if (aiNormVal.length < 4) return null;

  for (const [localNorm, field] of valueIndex) {
    if (localNorm === aiNormVal) continue; // already handled by exact-match path

    // AI value is a substring of local value (local is noisier/concatenated)
    if (
      localNorm.includes(aiNormVal) &&
      aiNormVal.length >= 4 &&
      aiNormVal.length / localNorm.length >= 0.4
    ) {
      return { field, matchType: "ai-contained-in-local" };
    }

    // Local value is a substring of AI value (AI has more complete data)
    if (
      aiNormVal.includes(localNorm) &&
      localNorm.length >= 4 &&
      localNorm.length / aiNormVal.length >= 0.4
    ) {
      return { field, matchType: "local-contained-in-ai" };
    }
  }
  return null;
}

export async function enhanceDocumentWithAI(doc: DocumentRecord): Promise<EnhanceResult> {
  await documentsRepo.patch(doc.id, { cloudAssistStatus: "pending" });

  try {
    const existingFields = await fieldsRepo.byDocument(doc.id);

    const existingKeyIndex = new Map<string, FieldRecord>(
      existingFields.map((f) => [f.key.toLowerCase(), f]),
    );
    const existingValueIndex = buildValueIndex(existingFields);

    // Determine if this is a scanned document that needs vision-based extraction.
    // A scanned doc has textSource="ocr" and very sparse rawText (the OCR output
    // was garbled/empty, which is exactly when we should send the image to AI).
    const isScannedDoc =
      doc.textSource === "ocr" || (doc.rawText?.trim().length ?? 0) < 50;

    let res: Response;
    let data: {
      success?: boolean;
      sections?: AiSection[];
      fields?: AiField[];
      documentType?: string;
      detectedType?: string;
      error?: string;
    };

    if (isScannedDoc) {
      // Vision path: fetch stored file blob, render each page, call /api/extract-image
      try {
        const { filesRepo } = await import("@/lib/storage/documentsRepo");
        const stored = await filesRepo.get(doc.id);
        const { renderPdfPageToImage } = await import("@/lib/pipeline/pdfReader");

        const pageCount = doc.pageCount ?? 1;
        const allSections: AiSection[] = [];
        let detectedType: string | undefined;

        for (let pg = 1; pg <= pageCount; pg++) {
          const bitmap = await renderPdfPageToImage(stored?.blob ?? new Blob(), pg);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(bitmap, 0, 0);
          const base64 = await new Promise<string>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error("toBlob null"));
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              },
              "image/png",
            );
          });

          const vRes = await fetch("/api/extract-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mimeType: "image/png" }),
          });
          if (!vRes.ok) continue;
          const vData = (await vRes.json()) as {
            success?: boolean;
            sections?: AiSection[];
            documentType?: string;
          };
          if (vData.sections) allSections.push(...vData.sections);
          if (!detectedType && vData.documentType) detectedType = vData.documentType;
        }

        data = {
          success: allSections.length > 0,
          sections: allSections,
          documentType: detectedType,
        };
        res = new Response(JSON.stringify(data), { status: 200 });
      } catch {
        // Vision path failed — fall through to text path
        data = { success: false, error: "Vision extraction failed" };
        res = new Response(JSON.stringify(data), { status: 500 });
      }
    } else {
      // 1. Primary endpoint: /api/extract
      res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks:
            doc.blockTree && doc.blockTree.length > 0
              ? doc.blockTree
              : [
                  {
                    id: "b1",
                    page: 1,
                    type: "paragraph",
                    text: doc.rawText,
                    bbox: { x: 0, y: 0, width: 100, height: 100 },
                  },
                ],
        }),
      });
      data = await res.json();
    }

    if (!isScannedDoc && !res.ok) {
      // 2. Fallback endpoint: /api/cloud-extract
      res = await fetch("/api/cloud-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: doc.filename,
          rawText: doc.rawText,
          existingFieldKeys: existingFields.map((f) => f.key),
        }),
      });
      data = await res.json();
    }

    if (!data.success && !data.sections && !data.fields) {
      const errMsg = data.error || `HTTP ${res.status}: Cloud extraction failed`;
      await documentsRepo.patch(doc.id, { cloudAssistStatus: "failed-fell-back" });
      return { success: false, sectionsCount: 0, newFieldsCount: 0, error: errMsg };
    }

    const newFields: FieldRecord[] = [];

    /**
     * Fields to update in-place:
     *  - relabel: update key only (exact value match, AI label is better)
     *  - upgrade: update key AND value (containment match, AI data is more complete/clean)
     *  - delete:  remove the local field (it was a partial/noise duplicate)
     */
    const fieldsToRelabel: Array<{ id: string; newKey: string }> = [];
    const fieldsToUpgrade: Array<{ id: string; newKey: string; newValue: string }> = [];
    const fieldIdsToDelete = new Set<string>();

    let sectionsCount = 0;

    function processAiField(
      rawKey?: string,
      rawValue?: string,
      rawValueType?: string,
      rawConfidence?: number,
      sectionTitle?: string,
      entryIndex?: number,
      sourceBlockId?: string,
    ) {
      if (!rawKey || !rawValue?.trim()) return;

      const normVal = normalizeValue(rawValue);
      const normKey = rawKey.toLowerCase();

      // ── Case 1: Exact value match ────────────────────────────────────────────
      const existingByValue = existingValueIndex.get(normVal);
      if (existingByValue) {
        const aiKeyIsNumbered = /[_\s]\d+$/.test(normKey);
        if (!aiKeyIsNumbered && existingByValue.key.toLowerCase() !== normKey) {
          fieldsToRelabel.push({ id: existingByValue.id, newKey: rawKey });
        }
        return; // do NOT duplicate
      }

      // ── Case 1b: Containment match ───────────────────────────────────────────
      // AI value contained in local (local is noisier) → upgrade local to AI's clean value
      // Local value contained in AI (AI is fuller) → upgrade local to AI's full value
      const containment = findContainmentMatch(normVal, existingValueIndex);
      if (containment) {
        if (!fieldIdsToDelete.has(containment.field.id)) {
          fieldsToUpgrade.push({
            id: containment.field.id,
            newKey: rawKey,
            newValue: rawValue,
          });
          // Remove old entry from indexes so subsequent AI siblings don't double-match it
          existingValueIndex.delete(normalizeValue(containment.field.value));
          existingKeyIndex.delete(containment.field.key.toLowerCase());
          // Register new value in indexes
          existingValueIndex.set(normVal, { ...containment.field, key: rawKey, value: rawValue });
          existingKeyIndex.set(normKey, containment.field);
        }
        return;
      }

      // ── Case 2: Same key already stored ─────────────────────────────────────
      if (existingKeyIndex.has(normKey)) return;

      // ── Case 3: Brand new field from AI ─────────────────────────────────────
      const valType = (rawValueType || "text") as FieldRecord["valueType"];
      const grounding = computeGrounding(rawValue, doc.rawText);
      const pStrength = patternStrength(valType, rawValue);
      const { confidence, tier } = scoreField({
        ocrConfidence: 1,
        patternStrength: pStrength,
        fingerprintBoost: 0.5,
        completeness: rawValue.trim() ? 1 : 0,
        provenance: grounding.provenance,
        groundingScore: grounding.groundingScore,
      });

      const newField: FieldRecord = {
        id: crypto.randomUUID(),
        documentId: doc.id,
        key: rawKey,
        value: rawValue,
        valueType: valType,
        confidence: rawConfidence ? Math.min(rawConfidence, confidence) : confidence,
        tier,
        bbox: { x: 0, y: 0, width: 0, height: 0, page: 1 },
        sourceBlockId: sourceBlockId || "",
        edited: false,
        editHistory: [],
        provenance: grounding.provenance,
        groundingScore: grounding.groundingScore,
        ...(sectionTitle !== undefined ? { sectionTitle } : {}),
        ...(entryIndex !== undefined ? { entryIndex } : {}),
      };

      newFields.push(newField);
      existingKeyIndex.set(normKey, newField);
      existingValueIndex.set(normVal, newField);
    }

    // Process recursive sections if present
    if (data.sections && Array.isArray(data.sections)) {
      sectionsCount = data.sections.length;
      for (const section of data.sections) {
        const sTitle = section.sectionTitle || "Extracted Section";
        const entries = section.entries || [];
        for (let eIdx = 0; eIdx < entries.length; eIdx += 1) {
          const entry = entries[eIdx];
          for (const f of entry.fields || []) {
            processAiField(
              f.label || f.key,
              f.value,
              f.valueType || "text",
              f.confidence,
              sTitle,
              eIdx,
              f.sourceBlockIds?.[0],
            );
          }
        }
      }
    } else if (data.fields && Array.isArray(data.fields)) {
      for (const f of data.fields) {
        processAiField(
          f.label || f.key,
          f.value,
          f.valueType || "text",
          f.confidence,
        );
      }
    }

    // Apply exact-value relabels (key only)
    for (const relabel of fieldsToRelabel) {
      const existing = await fieldsRepo.get(relabel.id);
      if (existing) {
        await fieldsRepo.put({ ...existing, key: relabel.newKey });
      }
    }

    // Apply containment upgrades (key + value)
    for (const upgrade of fieldsToUpgrade) {
      const existing = await fieldsRepo.get(upgrade.id);
      if (existing) {
        await fieldsRepo.put({ ...existing, key: upgrade.newKey, value: upgrade.newValue });
      }
    }

    if (newFields.length > 0) {
      await fieldsRepo.putAll(newFields);
    }

    const updatedDocType = data.documentType || data.detectedType || doc.documentType;
    await documentsRepo.patch(doc.id, {
      cloudAssistStatus: "succeeded",
      documentType: updatedDocType,
    });

    await auditRepo.add({
      documentId: doc.id,
      kind: "cloud-assist",
      label: `Cloud Assist: ${newFields.length} added, ${fieldsToRelabel.length} relabelled, ${fieldsToUpgrade.length} upgraded`,
    });

    return {
      success: true,
      sectionsCount,
      newFieldsCount: newFields.length,
      documentType: updatedDocType,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unexpected cloud enhancement error";
    await documentsRepo.patch(doc.id, { cloudAssistStatus: "failed-fell-back" });
    return { success: false, sectionsCount: 0, newFieldsCount: 0, error: errMsg };
  }
}
