/**
 * visionExtract.ts
 *
 * Sends a rendered page bitmap to the /api/extract-image vision endpoint
 * and returns the extracted fields as FieldRecord candidates.
 *
 * Used when Tesseract OCR confidence is too low to trust the text output —
 * the vision model reads the image directly and returns structured fields.
 */

import type { FieldRecord } from "@/lib/types";

export interface VisionExtractResult {
  fields: Omit<FieldRecord, "id" | "documentId" | "bbox" | "confidence" | "tier" | "edited" | "editHistory">[];
  documentType?: string;
  rawText?: string;
}

/**
 * Convert an ImageBitmap to a base64-encoded PNG data URL.
 * Works in the browser main thread only (requires HTMLCanvasElement).
 */
async function bitmapToBase64(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("toBlob returned null"));
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      },
      "image/png",
    );
  });
}

/**
 * Ask the vision AI to extract structured fields from a rendered page image.
 *
 * @param bitmap  Rendered page image (from renderPdfPageToImage).
 * @param docId   Used to tag returned field records.
 * @param page    Page number (1-indexed).
 * @returns       Partial field records ready for confidence scoring + storage.
 */
export async function visionExtractPage(
  bitmap: ImageBitmap,
  docId: string,
  page: number,
): Promise<VisionExtractResult> {
  try {
    const base64 = await bitmapToBase64(bitmap);
    const res = await fetch("/api/extract-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: "image/png",
      }),
    });

    if (!res.ok) return { fields: [] };
    const data = (await res.json()) as {
      success?: boolean;
      documentType?: string;
      sections?: Array<{
        sectionTitle?: string;
        entries?: Array<{
          fields?: Array<{
            label?: string;
            key?: string;
            value?: string;
            valueType?: string;
            confidence?: number;
          }>;
        }>;
      }>;
      fields?: Array<{
        label?: string;
        key?: string;
        value?: string;
        valueType?: string;
        confidence?: number;
      }>;
    };

    if (!data.success) return { fields: [] };

    const rawFields: typeof data.fields = [];

    if (data.sections) {
      for (const section of data.sections) {
        for (const entry of section.entries ?? []) {
          for (const f of entry.fields ?? []) {
            rawFields.push(f);
          }
        }
      }
    } else if (data.fields) {
      rawFields.push(...data.fields);
    }

    const fields = rawFields
      .filter((f) => f && (f.label || f.key) && f.value?.trim())
      .map((f) => ({
        documentId: docId,
        key: f.label ?? f.key ?? "Field",
        value: f.value!.trim(),
        valueType: (f.valueType ?? "text") as FieldRecord["valueType"],
        sourceBlockId: `vision-p${page}`,
        // Pass AI confidence through as a hint — the caller will blend it with
        // patternStrength / ocrConfidence during the full scoreField pass.
        _aiConfidence: Math.min(1, (f.confidence ?? 0.8)),
      }));

    return { fields, documentType: data.documentType };
  } catch {
    // Vision API call failed — degrade gracefully (no crash, no fields from this page)
    return { fields: [] };
  }
}
