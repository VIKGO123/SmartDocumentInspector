import type { FieldRecord } from "@/lib/types";
import { getDb } from "./db";

export const fieldsRepo = {
  async putAll(fields: FieldRecord[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("fields", "readwrite");
    await Promise.all(fields.map((field) => tx.store.put(field)));
    await tx.done;
  },
  async put(field: FieldRecord): Promise<void> {
    await (await getDb()).put("fields", field);
  },
  async get(id: string): Promise<FieldRecord | undefined> {
    return (await getDb()).get("fields", id);
  },
  async byDocument(documentId: string): Promise<FieldRecord[]> {
    return (await getDb()).getAllFromIndex("fields", "documentId", documentId);
  },
  async all(): Promise<FieldRecord[]> {
    return (await getDb()).getAll("fields");
  },
  async deleteByDocument(documentId: string): Promise<void> {
    const db = await getDb();
    const rows = await db.getAllFromIndex("fields", "documentId", documentId);
    const tx = db.transaction("fields", "readwrite");
    await Promise.all(rows.map((row) => tx.store.delete(row.id)));
    await tx.done;
  },
  async edit(id: string, newValue: string): Promise<FieldRecord | undefined> {
    const db = await getDb();
    const field = await db.get("fields", id);
    if (!field) return undefined;
    const next: FieldRecord = {
      ...field,
      value: newValue,
      edited: true,
      missing: field.required ? newValue.trim().length === 0 : false,
      editHistory: [
        ...field.editHistory,
        { oldValue: field.value, newValue, at: new Date().toISOString() },
      ],
    };
    await db.put("fields", next);
    return next;
  },
};
