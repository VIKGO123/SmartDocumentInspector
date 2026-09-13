import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AuditEvent,
  DocumentRecord,
  FieldRecord,
  StoredFile,
} from "@/lib/types";

interface InspectorDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentRecord;
    indexes: { fileHash: string; status: string };
  };
  fields: {
    key: string;
    value: FieldRecord;
    indexes: { documentId: string; valueType: string };
  };
  auditEvents: {
    key: string;
    value: AuditEvent;
    indexes: { documentId: string };
  };
  files: {
    key: string;
    value: StoredFile;
  };
}

const DB_NAME = "document-inspector";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<InspectorDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<InspectorDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available");
  }
  if (!dbPromise) {
    dbPromise = openDB<InspectorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          const documents = db.createObjectStore("documents", { keyPath: "id" });
          documents.createIndex("fileHash", "fileHash", { unique: false });
          documents.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains("fields")) {
          const fields = db.createObjectStore("fields", { keyPath: "id" });
          fields.createIndex("documentId", "documentId", { unique: false });
          fields.createIndex("valueType", "valueType", { unique: false });
        }
        if (!db.objectStoreNames.contains("auditEvents")) {
          const events = db.createObjectStore("auditEvents", { keyPath: "id" });
          events.createIndex("documentId", "documentId", { unique: false });
        }
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "documentId" });
        }
      },
      blocked() {
        console.warn("[IndexedDB] Database upgrade blocked by another open tab");
      },
      blocking() {
        console.warn("[IndexedDB] Closing database connection to unblock upgrade in another tab");
        if (dbPromise) {
          dbPromise.then((db) => db.close()).catch(() => {});
          dbPromise = null;
        }
      },
      terminated() {
        console.warn("[IndexedDB] Connection unexpectedly terminated by browser engine");
        dbPromise = null;
      },
    }).catch((err) => {
      // Self-healing: clear cached rejected promise so future operations can retry
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Manually closes the active IndexedDB connection and resets the singleton.
 * Useful for testing, database migrations, or hard resets.
 */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Ignore close errors on already-broken promises
    } finally {
      dbPromise = null;
    }
  }
}
