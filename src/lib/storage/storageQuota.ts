import { getDb } from "./db";

/**
 * Custom typed error thrown when browser IndexedDB storage limit is reached.
 */
export class StorageQuotaError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Browser storage quota exceeded. Please free up space by deleting older documents in Document History.",
    );
    this.name = "StorageQuotaError";
  }
}

/**
 * Accurately detects whether an error was caused by reaching browser storage quota limits
 * across Chrome, Firefox, Safari (WebKit), and Edge.
 */
export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof StorageQuotaError) return true;

  if (typeof err === "object") {
    const errorObj = err as { name?: string; code?: number; message?: string };
    if (
      errorObj.name === "QuotaExceededError" ||
      errorObj.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      errorObj.code === 22 || // Legacy WebKit QUOTA_EXCEEDED_ERR
      (typeof errorObj.message === "string" &&
        /quota|storage full|exceeded the quota|out of disk space/i.test(
          errorObj.message,
        ))
    ) {
      return true;
    }
  }

  return false;
}

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  availableBytes: number;
  usageMB: string;
  quotaMB: string;
  isPersistent: boolean;
}

/**
 * Requests persistent storage from the browser so IndexedDB documents are not
 * automatically evicted during background browser cache cleanup.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Retrieves current browser storage usage and quota in bytes and human-readable MB.
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }

  try {
    const [estimate, isPersistent] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted().catch(() => false) : Promise.resolve(false),
    ]);

    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;
    const availableBytes = Math.max(0, quotaBytes - usageBytes);
    const percentUsed =
      quotaBytes > 0 ? Math.min(100, Math.round((usageBytes / quotaBytes) * 100)) : 0;

    return {
      usageBytes,
      quotaBytes,
      percentUsed,
      availableBytes,
      usageMB: (usageBytes / (1024 * 1024)).toFixed(1),
      quotaMB: (quotaBytes / (1024 * 1024)).toFixed(0),
      isPersistent,
    };
  } catch {
    return null;
  }
}

/**
 * Orphaned Storage Garbage Collection:
 * Scans the database and cleans up any binary files in 'files' or field entries in 'fields'
 * whose corresponding document record in 'documents' has been deleted or orphaned.
 *
 * Returns the count of deleted orphaned entries.
 */
export async function purgeOrphanedStorage(): Promise<{
  deletedFiles: number;
  deletedFields: number;
  deletedAuditEvents: number;
}> {
  const db = await getDb();
  const docs = await db.getAll("documents");
  const validDocIds = new Set(docs.map((d) => d.id));

  let deletedFiles = 0;
  let deletedFields = 0;
  let deletedAuditEvents = 0;

  // 1. Check files store
  const allStoredFiles = await db.getAll("files");
  const orphanFileIds: string[] = [];
  for (const file of allStoredFiles) {
    if (!validDocIds.has(file.documentId)) {
      orphanFileIds.push(file.documentId);
    }
  }

  if (orphanFileIds.length > 0) {
    const tx = db.transaction("files", "readwrite");
    for (const id of orphanFileIds) {
      await tx.store.delete(id);
      deletedFiles += 1;
    }
    await tx.done;
  }

  // 2. Check fields store
  const allFields = await db.getAll("fields");
  const orphanFieldIds: string[] = [];
  for (const field of allFields) {
    if (!validDocIds.has(field.documentId)) {
      orphanFieldIds.push(field.id);
    }
  }

  if (orphanFieldIds.length > 0) {
    const tx = db.transaction("fields", "readwrite");
    for (const id of orphanFieldIds) {
      await tx.store.delete(id);
      deletedFields += 1;
    }
    await tx.done;
  }

  // 3. Check auditEvents store
  const allEvents = await db.getAll("auditEvents");
  const orphanEventIds: string[] = [];
  for (const event of allEvents) {
    if (!validDocIds.has(event.documentId)) {
      orphanEventIds.push(event.id);
    }
  }

  if (orphanEventIds.length > 0) {
    const tx = db.transaction("auditEvents", "readwrite");
    for (const id of orphanEventIds) {
      await tx.store.delete(id);
      deletedAuditEvents += 1;
    }
    await tx.done;
  }

  return { deletedFiles, deletedFields, deletedAuditEvents };
}
