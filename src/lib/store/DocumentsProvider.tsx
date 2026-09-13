"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuditEvent, DocumentRecord, FieldRecord } from "@/lib/types";
import { DuplicateUploadError, runPipeline } from "@/lib/pipeline/runPipeline";
import { auditRepo } from "@/lib/storage/auditRepo";
import { deleteDocument, documentsRepo } from "@/lib/storage/documentsRepo";
import { fieldsRepo } from "@/lib/storage/fieldsRepo";
import { isQuotaError, requestPersistentStorage } from "@/lib/storage/storageQuota";

interface Store {
  ready: boolean;
  documents: DocumentRecord[];
  fieldsByDoc: Record<string, FieldRecord[]>;
  refresh: () => Promise<void>;
  ingestFiles: (files: File[]) => Promise<string[]>;
  updateField: (field: FieldRecord) => void;
  updateDocument: (doc: DocumentRecord) => void;
  removeDocument: (id: string) => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [fieldsByDoc, setFieldsByDoc] = useState<Record<string, FieldRecord[]>>(
    {},
  );

  const refresh = useCallback(async () => {
    const [docs, fields] = await Promise.all([
      documentsRepo.all(),
      fieldsRepo.all(),
    ]);
    const grouped: Record<string, FieldRecord[]> = {};
    for (const field of fields) {
      grouped[field.documentId] = [...(grouped[field.documentId] ?? []), field];
    }
    setDocuments(docs);
    setFieldsByDoc(grouped);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void requestPersistentStorage();

    (async () => {
      const [docs, fields] = await Promise.all([
        documentsRepo.all(),
        fieldsRepo.all(),
      ]);
      if (cancelled) return;
      const grouped: Record<string, FieldRecord[]> = {};
      for (const field of fields) {
        grouped[field.documentId] = [...(grouped[field.documentId] ?? []), field];
      }
      setDocuments(docs);
      setFieldsByDoc(grouped);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      const rejections: string[] = [];
      // Process files sequentially to prevent WebWorker OOM, canvas memory spikes,
      // and IndexedDB transaction write collisions
      for (const file of files) {
        try {
          await runPipeline(file, (doc) => {
            setDocuments((prev) => {
              const rest = prev.filter((d) => d.id !== doc.id);
              return [doc, ...rest].sort((a, b) =>
                b.uploadedAt.localeCompare(a.uploadedAt),
              );
            });
          });
        } catch (err) {
          if (err instanceof DuplicateUploadError) {
            rejections.push(
              `This looks identical to ${err.existingName}, already uploaded — open it instead?::${err.existingId}`,
            );
          } else if (isQuotaError(err)) {
            rejections.push(
              `Browser storage is full for "${file.name}". Please delete older documents in Document History to free up space.`,
            );
          } else {
            rejections.push(
              err instanceof Error
                ? err.message
                : `Could not read ${file.name}`,
            );
          }
        }
      }
      // Single database refresh after the entire batch finishes processing
      await refresh();
      return rejections;
    },
    [refresh],
  );

  const updateField = useCallback((field: FieldRecord) => {
    setFieldsByDoc((prev) => {
      const list = prev[field.documentId] ?? [];
      const exists = list.some((f) => f.id === field.id);
      return {
        ...prev,
        [field.documentId]: exists
          ? list.map((f) => (f.id === field.id ? field : f))
          : [...list, field],
      };
    });
  }, []);

  const updateDocument = useCallback((doc: DocumentRecord) => {
    setDocuments((prev) => prev.map((item) => (item.id === doc.id ? doc : item)));
  }, []);

  const removeDocument = useCallback(
    async (id: string) => {
      await deleteDocument(id);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      ready,
      documents,
      fieldsByDoc,
      refresh,
      ingestFiles,
      updateField,
      updateDocument,
      removeDocument,
    }),
    [ready, documents, fieldsByDoc, refresh, ingestFiles, updateField, updateDocument, removeDocument],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDocuments() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}

export function useDocument(id: string) {
  const { documents, fieldsByDoc, ready, refresh, updateField, updateDocument } = useDocuments();
  const document = documents.find((d) => d.id === id);
  const fields = useMemo(() => fieldsByDoc[id] ?? [], [fieldsByDoc, id]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const status = document?.status;
  const fieldSig = fields.map((f) => `${f.id}:${f.value}:${f.edited}`).join("|");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    auditRepo.byDocument(id).then((rows) => {
      if (!cancelled) setEvents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [id, status, fieldSig]);

  return { ready, document, fields, events, refresh, updateField, updateDocument, setEvents };
}
