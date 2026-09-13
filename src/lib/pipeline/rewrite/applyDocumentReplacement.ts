import type { BBox, DocumentRecord } from "@/lib/types";
import { sniffFile } from "../fileSniff";
import { replaceOnce } from "./textReplace";
import { replaceInPdf } from "./pdf";
import { replaceInDocx } from "./word";
import { documentsRepo, filesRepo } from "@/lib/storage/documentsRepo";

export async function applyDocumentReplacement(opts: {
  documentId: string;
  oldValue: string;
  newValue: string;
  bbox?: BBox;
}): Promise<DocumentRecord | undefined> {
  const { documentId, oldValue, newValue, bbox } = opts;
  if (!oldValue || oldValue === newValue) {
    return documentsRepo.get(documentId);
  }
  const [doc, stored] = await Promise.all([
    documentsRepo.get(documentId),
    filesRepo.get(documentId),
  ]);
  if (!doc || !stored) return doc;

  const file = new File([stored.blob], stored.filename, { type: stored.mimeType });
  const kind = await sniffFile(file);
  let nextBlob = stored.blob;
  let nextName = stored.filename;
  let nextMime = stored.mimeType;

  if (kind === "pdf") {
    nextBlob = await replaceInPdf(stored.blob, newValue, bbox);
  } else if (kind === "docx") {
    nextBlob = await replaceInDocx(stored.blob, oldValue, newValue);
  } else if (kind === "text") {
    const text = await stored.blob.text();
    nextBlob = new Blob([replaceOnce(text, oldValue, newValue)], { type: "text/plain" });
  } else if (kind === "doc") {
    const text = replaceOnce(doc.rawText, oldValue, newValue);
    nextName = stored.filename.replace(/\.doc$/i, ".txt");
    nextMime = "text/plain";
    nextBlob = new Blob([text], { type: "text/plain" });
  }

  await filesRepo.put({
    documentId,
    blob: nextBlob,
    mimeType: nextMime,
    filename: nextName,
  });

  const rawText = replaceOnce(doc.rawText, oldValue, newValue);
  const blockTree = replaceFirstMatchingBlock(doc.blockTree, oldValue, newValue, bbox);
  return documentsRepo.patch(documentId, {
    rawText,
    blockTree,
    filename: nextName,
    mimeType: nextMime,
    fileRevision: (doc.fileRevision ?? 0) + 1,
  });
}

function replaceFirstMatchingBlock(
  blocks: DocumentRecord["blockTree"],
  oldValue: string,
  newValue: string,
  bbox?: BBox,
): DocumentRecord["blockTree"] {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block.text.includes(oldValue)) continue;
    let score = 1;
    if (block.text.trim() === oldValue) score += 50;
    if (bbox && block.bbox.page === bbox.page) {
      const dx = Math.abs(block.bbox.x - bbox.x);
      const dy = Math.abs(block.bbox.y - bbox.y);
      score += 10 / (1 + dx + dy);
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0) return blocks;
  return blocks.map((block, i) =>
    i === best ? { ...block, text: replaceOnce(block.text, oldValue, newValue) } : block,
  );
}

export async function downloadStoredDocument(documentId: string): Promise<void> {
  const stored = await filesRepo.get(documentId);
  if (!stored) throw new Error("The file is no longer in this browser.");
  const url = URL.createObjectURL(stored.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = stored.filename;
  a.click();
  URL.revokeObjectURL(url);
}
