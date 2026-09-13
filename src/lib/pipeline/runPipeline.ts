import type {
  Block,
  DocumentRecord,
  DocumentStatus,
  FieldRecord,
  PositionedItem,
} from "@/lib/types";
import { reconstructBlocks, blocksFromPlainText } from "./blockReconstruction";
import { looksGarbled, patternStrength, scoreField } from "./confidence";
import { extractFields } from "./extraction";
import { extractResumeProfile } from "./extraction/resumeProfile";
import { partitionDocumentContent } from "./extraction/partitionContent";
import { bindToSchema } from "./extraction/bindToSchema";
import { extractGenericFields } from "./extraction/genericScannedDocExtractor";
import { classifyDocument } from "./classifyDocument";
import { ALLOWED_FORMATS, sniffFile } from "./fileSniff";
import { hashFile, layoutFingerprint } from "./fingerprint";
import { ocrImage } from "./ocr";
import { readPdf, renderPdfPageToImage } from "./pdfReader";
import { visionExtractPage } from "./visionExtract";
import { extractDocText, extractDocxText } from "./rewrite/word";
import { auditRepo } from "@/lib/storage/auditRepo";
import { documentsRepo, filesRepo } from "@/lib/storage/documentsRepo";
import { fieldsRepo } from "@/lib/storage/fieldsRepo";

export type PipelineListener = (doc: DocumentRecord) => void;

export class DuplicateUploadError extends Error {
  existingId: string;
  existingName: string;
  constructor(existing: DocumentRecord) {
    super(`This looks identical to ${existing.filename}, already uploaded`);
    this.existingId = existing.id;
    this.existingName = existing.filename;
  }
}

export async function runPipeline(
  file: File,
  onUpdate?: PipelineListener,
  opts?: { replaceId?: string },
): Promise<DocumentRecord> {
  const kind = await sniffFile(file);
  if (kind === "unsupported") {
    throw new Error(`${file.name} isn't supported yet — try ${ALLOWED_FORMATS}.`);
  }
  if (file.size === 0) {
    throw new Error(`${file.name} is empty — try another file.`);
  }

  const fileHash = await hashFile(file);
  if (!opts?.replaceId) {
    const duplicate = await documentsRepo.findByHash(fileHash);
    if (duplicate) throw new DuplicateUploadError(duplicate);
  }

  const existing = opts?.replaceId
    ? await documentsRepo.get(opts.replaceId)
    : undefined;
  const id = opts?.replaceId ?? crypto.randomUUID();
  if (opts?.replaceId) {
    await fieldsRepo.deleteByDocument(id);
  }
  const uploadedAt = existing?.uploadedAt ?? new Date().toISOString();
  let doc: DocumentRecord = {
    id,
    filename: file.name,
    uploadedAt,
    fileHash,
    status: "queued",
    rawText: "",
    blockTree: [],
    layoutFingerprint: "",
    mimeType: file.type || mimeForKind(kind),
    pageCount: kind === "pdf" ? undefined : 1,
    rescans: (existing?.rescans ?? 0) + (opts?.replaceId ? 1 : 0),
  };

  try {
    await documentsRepo.put(doc);
    await filesRepo.put({
      documentId: id,
      blob: file,
      mimeType: doc.mimeType ?? file.type,
      filename: file.name,
    });
    await auditRepo.add({
      documentId: id,
      kind: "uploaded",
      label: "Uploaded",
    });
  } catch (err) {
    // Roll back to avoid leaving a dead "queued" zombie document in IndexedDB
    await documentsRepo.remove(id).catch(() => {});
    await filesRepo.remove(id).catch(() => {});
    throw err;
  }
  onUpdate?.(doc);

  const setStatus = async (
    status: DocumentStatus,
    extra: Partial<DocumentRecord> = {},
    label?: string,
  ) => {
    const next = await documentsRepo.patch(id, { status, ...extra });
    if (!next) throw new Error("Document disappeared during processing");
    doc = next;
    await auditRepo.add({
      documentId: id,
      kind: "status",
      label: label ?? statusLabel(status, extra.statusDetail),
    });
    onUpdate?.(doc);
  };

  try {
    await setStatus("extracting-text");
    const items: PositionedItem[] = [];
    let blocks: Block[] = [];
    let usedOcr = false;
    let usedDigital = false;
    /** Fields extracted by vision AI (for scanned pages where OCR failed) */
    const visionCandidates: Array<{
      key: string;
      value: string;
      valueType: FieldRecord["valueType"];
      sourceBlockId: string;
      _aiConfidence: number;
    }> = [];

    if (kind === "text" || kind === "docx" || kind === "doc") {
      const text =
        kind === "docx"
          ? await extractDocxText(file)
          : kind === "doc"
            ? await extractDocText(file)
            : await file.text();
      blocks = blocksFromPlainText(text);
      usedDigital = true;
      doc = (await documentsRepo.patch(id, { rawText: text, pageCount: 1 })) ?? doc;
    } else if (kind === "pdf") {
      const pages = await readPdf(file);
      await documentsRepo.patch(id, { pageCount: pages.length });
      for (const page of pages) {
        if (page.needsOcr) {
          usedOcr = true;
          await setStatus(
            "running-ocr",
            {
              statusDetail: `Rendering page ${page.page} of ${pages.length}…`,
              pageCount: pages.length,
            },
            `Text extracted (page ${page.page} needs OCR)`,
          );
          const bitmap = await renderPdfPageToImage(file, page.page);
          const ocr = await ocrImage(bitmap, page.page);

          // Check OCR quality — if poor, fall back to vision AI for this page.
          const meanConf =
            ocr.words.length > 0
              ? ocr.words.reduce((s, w) => s + w.confidence, 0) / ocr.words.length
              : 0;
          const charCount = ocr.words.reduce((s, w) => s + w.text.length, 0);
          const ocrReliable = meanConf >= 60 && charCount >= 20;

          if (ocrReliable) {
            items.push(
              ...ocr.words.map((w) => ({
                text: w.text,
                bbox: w.bbox,
                confidence: w.confidence,
                fontSize: w.bbox.height,
              })),
            );
          } else {
            // OCR quality too low — send page image to vision AI directly
            await setStatus(
              "running-ocr",
              {
                statusDetail: `OCR confidence low on page ${page.page} — using Vision AI…`,
                pageCount: pages.length,
              },
              `Page ${page.page}: falling back to Vision AI extraction`,
            );
            const vr = await visionExtractPage(bitmap, id, page.page);
            visionCandidates.push(...(vr.fields as typeof visionCandidates));

            // Still push whatever OCR text we got (even if low quality) so
            // rawText isn't completely empty.
            items.push(
              ...ocr.words.map((w) => ({
                text: w.text,
                bbox: w.bbox,
                confidence: w.confidence * 0.5, // penalised confidence
                fontSize: w.bbox.height,
              })),
            );
          }
        } else {
          usedDigital = true;
          items.push(...page.items);
        }
      }
    } else {
      throw new Error(`${file.name} isn't supported yet — try ${ALLOWED_FORMATS}.`);
    }

    await setStatus("detecting-layout", { statusDetail: undefined });
    if (!blocks.length) blocks = reconstructBlocks(items);
    const rawText = blocks.map((b) => b.text).join("\n");
    const layoutFp = layoutFingerprint(blocks);
    const fingerprintBoost = await boostForFingerprint(layoutFp, id);

    await setStatus("scoring-confidence", {
      rawText,
      blockTree: blocks,
      layoutFingerprint: layoutFp,
    });

    const schema = classifyDocument(file.name, rawText, blocks);
    const generic = extractFields(id, blocks);
    const genericScanned = extractGenericFields(rawText).map((gf) => ({
      id: crypto.randomUUID(),
      documentId: id,
      key: gf.label,
      value: gf.value,
      valueType: (gf.valueType === "id" ? "id" : gf.valueType ?? "text") as FieldRecord["valueType"],
      bbox: blocks[0]?.bbox ?? { x: 0, y: 0, width: 0, height: 0, page: 1 },
      sourceBlockId: blocks[0]?.id ?? "",
      edited: false,
      editHistory: [],
    }));
    const resume =
      schema.id === "resume" || /resume|cv|professional summary/i.test(`${file.name} ${rawText}`)
        ? extractResumeProfile(id, blocks, rawText)
        : { fields: [] as typeof generic, notes: [] as string[] };
    const extracted = bindToSchema(schema, [...resume.fields, ...generic, ...genericScanned], blocks);
    const fields: FieldRecord[] = extracted.map((field) => {
      const source = blocks.find((b) => b.id === field.sourceBlockId);
      const ocrConfidence = field.missing ? 0.2 : (source?.confidence ?? 1);
      const completeness = field.value.trim() ? 1 : 0;
      const pattern = field.missing
        ? 0
        : Math.max(patternStrength(field.valueType, field.value), field.semanticFit ?? 0);
      let { confidence, tier } = scoreField({
        ocrConfidence,
        patternStrength: pattern,
        fingerprintBoost,
        completeness,
      });
      if (field.missing || (field.required && !field.value.trim())) {
        confidence = Math.min(confidence, 0.35);
        tier = "low";
      } else if (looksGarbled(field.value) && tier === "high") {
        confidence = Math.min(confidence, 0.49);
        tier = "low";
      } else if ((field.semanticFit ?? 0) >= 0.95 && completeness) {
        confidence = Math.max(confidence, 0.9);
        tier = "high";
      } else if ((field.semanticFit ?? 0) >= 0.7 && completeness) {
        confidence = Math.max(confidence, 0.82);
        tier = "high";
      }
      return { ...field, confidence, tier };
    });

    // Final dedup: collapse any remaining fields that share the same normalised
    // value (resume extractor + generic extractor can each find the same email /
    // phone / location independently). Keep the highest-confidence winner.
    const dedupedFields = (() => {
      const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
      const best = new Map<string, FieldRecord>();
      for (const f of fields) {
        if (!f.value.trim()) continue; // preserve empty required placeholders
        const key = norm(f.value);
        const existing = best.get(key);
        if (!existing || f.confidence > existing.confidence) {
          best.set(key, f);
        }
      }
      const kept = new Set(best.values());
      return fields.filter((f) => !f.value.trim() || kept.has(f));
    })();

    // Score and merge any fields extracted by the vision AI fallback.
    // These come from pages where Tesseract OCR quality was too low to trust.
    const visionFields: FieldRecord[] = visionCandidates
      .filter((vc) => vc.value?.trim())
      .map((vc) => {
        const { confidence, tier } = scoreField({
          ocrConfidence: 1,           // image quality = 1, OCR unreliable for this page
          patternStrength: patternStrength(vc.valueType, vc.value),
          fingerprintBoost: 0.6,      // slight boost — AI has seen the layout
          completeness: 1,
        });
        const aiConf = (vc as unknown as { _aiConfidence?: number })._aiConfidence ?? 0.8;
        return {
          id: crypto.randomUUID(),
          documentId: id,
          key: vc.key,
          value: vc.value,
          valueType: vc.valueType,
          confidence: Math.max(aiConf, confidence),
          tier,
          bbox: { x: 0, y: 0, width: 0, height: 0, page: 1 },
          sourceBlockId: vc.sourceBlockId,
          edited: false,
          editHistory: [],
        } satisfies FieldRecord;
      });

    // Merge vision fields with local deduped fields — vision wins on value
    // clashes (it's more reliable than garbled OCR).
    const allFields = (() => {
      const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
      const best = new Map<string, FieldRecord>();
      // Local fields first (lower priority for scanned pages)
      for (const f of dedupedFields) {
        if (!f.value.trim()) { best.set(f.id, f); continue; }
        const key = norm(f.value);
        const existing = best.get(key);
        if (!existing || f.confidence > existing.confidence) best.set(key, f);
      }
      // Vision fields second — override same-value local fields if vision is more confident
      for (const f of visionFields) {
        if (!f.value.trim()) continue;
        const key = norm(f.value);
        const existing = best.get(key);
        if (!existing || f.confidence >= existing.confidence) best.set(key, f);
      }
      return [...best.values()];
    })();

    await fieldsRepo.putAll(allFields);

    const { fields: named, notes } = partitionDocumentContent(
      allFields,
      blocks,
      resume.notes,
    );
    const usable = named.filter((f) => f.value.trim());
    const textSource: DocumentRecord["textSource"] =
      usedOcr && usedDigital ? "mixed" : usedOcr ? "ocr" : "digital";
    const avg =
      usable.length === 0
        ? 0
        : Math.round((usable.reduce((s, f) => s + f.confidence, 0) / usable.length) * 100);
    const terminal: DocumentStatus =
      usable.length < 1 ? "needs-manual-entry" : "done";
    await setStatus(terminal, {
      rawText,
      blockTree: blocks,
      layoutFingerprint: layoutFp,
      documentType: schema.label,
      schemaId: schema.id,
      notes,
      textSource,
      quality: {
        extractionConfidence: avg,
        pageLegibility: textSource === "ocr" ? 70 : 100,
        textSource,
        handwritingPct: textSource === "ocr" ? 10 : 0,
        checks: { line_arithmetic: "n/a", arithmetic: "n/a" },
        checksPassed: 0,
        checksTotal: 0,
        advice: [],
        userInput: { edited: 0, flagged: 0, rescans: 0 },
      },
      statusDetail: undefined,
    }, terminal === "done"
      ? `Classified as ${schema.label} — ${usable.length} fields extracted`
      : "We couldn't find structured fields here");

    return doc;
  } catch (err) {
    const failureReason =
      err instanceof Error ? err.message : "Extraction failed unexpectedly.";
    await setStatus("failed", { failureReason }, `Failed: ${failureReason}`);
    throw err;
  }
}

export async function rescanDocument(
  documentId: string,
  onUpdate?: PipelineListener,
): Promise<DocumentRecord> {
  const stored = await filesRepo.get(documentId);
  if (!stored) throw new Error("Original file is no longer in this browser.");
  const file = new File([stored.blob], stored.filename, {
    type: stored.mimeType,
  });
  return runPipeline(file, onUpdate, { replaceId: documentId });
}

async function boostForFingerprint(fp: string, currentId: string): Promise<number> {
  const all = await documentsRepo.all();
  const repeats = all.filter(
    (d) => d.id !== currentId && d.layoutFingerprint === fp && fp.length > 0,
  );
  return repeats.length ? 0.9 : 0.4;
}

function mimeForKind(kind: "pdf" | "text" | "docx" | "doc"): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (kind === "doc") return "application/msword";
  return "text/plain";
}

function statusLabel(status: DocumentStatus, detail?: string): string {
  if (detail) return detail.replace(/…$/, "");
  switch (status) {
    case "extracting-text":
      return "Text extracted";
    case "running-ocr":
      return "OCR complete";
    case "detecting-layout":
      return "Layout detected";
    case "scoring-confidence":
      return "Confidence scored";
    case "needs-review":
      return "Needs review";
    case "needs-manual-entry":
      return "Needs manual entry";
    case "done":
      return "Committed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}
