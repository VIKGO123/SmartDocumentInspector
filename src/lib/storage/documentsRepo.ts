import type { DocumentRecord, StoredFile } from "@/lib/types";
import { getDb } from "./db";
import { isQuotaError, StorageQuotaError } from "./storageQuota";

export const documentsRepo = {
  async put(doc: DocumentRecord): Promise<void> {
    try {
      await (await getDb()).put("documents", doc);
    } catch (err) {
      if (isQuotaError(err)) {
        throw new StorageQuotaError(
          `Browser storage quota exceeded while saving document "${doc.filename}". Please delete older documents in Document History.`,
        );
      }
      throw err;
    }
  },
  async get(id: string): Promise<DocumentRecord | undefined> {
    return (await getDb()).get("documents", id);
  },
  async all(): Promise<DocumentRecord[]> {
    const rows = await (await getDb()).getAll("documents");
    return rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },
  async findByHash(fileHash: string): Promise<DocumentRecord | undefined> {
    return (await getDb()).getFromIndex("documents", "fileHash", fileHash);
  },
  async patch(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord | undefined> {
    const db = await getDb();
    const current = await db.get("documents", id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    try {
      await db.put("documents", next);
    } catch (err) {
      if (isQuotaError(err)) {
        throw new StorageQuotaError(
          `Browser storage quota exceeded while updating "${current.filename}".`,
        );
      }
      throw err;
    }
    return next;
  },
  async remove(id: string): Promise<void> {
    await (await getDb()).delete("documents", id);
  },
};

export const filesRepo = {
  async put(file: StoredFile): Promise<void> {
    // Normalise File objects to safe binary Blobs to prevent Safari / WebKit handle detachment crashes
    const safeBlob =
      typeof file.blob.slice === "function"
        ? file.blob.slice(0, file.blob.size, file.blob.type || file.mimeType)
        : file.blob;

    try {
      await (await getDb()).put("files", {
        documentId: file.documentId,
        blob: safeBlob,
        mimeType: file.mimeType || safeBlob.type || "application/octet-stream",
        filename: file.filename,
      });
    } catch (err) {
      if (isQuotaError(err)) {
        throw new StorageQuotaError(
          `Browser storage is full. Cannot store original file for "${file.filename}". Please delete older documents in Document History to free up space.`,
        );
      }
      throw err;
    }
  },
  async get(documentId: string): Promise<StoredFile | undefined> {
    return (await getDb()).get("files", documentId);
  },
  async remove(documentId: string): Promise<void> {
    await (await getDb()).delete("files", documentId);
  },
};

/**
 * Atomically deletes a document and all related files, extracted fields,
 * and audit events in a single IndexedDB transaction.
 */
export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["documents", "files", "fields", "auditEvents"], "readwrite");

  // 1. Delete document record
  await tx.objectStore("documents").delete(id);

  // 2. Delete stored file binary blob
  await tx.objectStore("files").delete(id);

  // 3. Delete all extracted fields linked to this document
  const fieldsIndex = tx.objectStore("fields").index("documentId");
  let fieldCursor = await fieldsIndex.openCursor(id);
  while (fieldCursor) {
    await fieldCursor.delete();
    fieldCursor = await fieldCursor.continue();
  }

  // 4. Delete all audit events linked to this document
  const auditIndex = tx.objectStore("auditEvents").index("documentId");
  let auditCursor = await auditIndex.openCursor(id);
  while (auditCursor) {
    await auditCursor.delete();
    auditCursor = await auditCursor.continue();
  }

  await tx.done;
}
