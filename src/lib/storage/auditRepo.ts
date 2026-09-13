import type { AuditEvent } from "@/lib/types";
import { getDb } from "./db";

export const auditRepo = {
  async add(event: Omit<AuditEvent, "id" | "at"> & { at?: string }): Promise<AuditEvent> {
    const row: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      at: event.at ?? new Date().toISOString(),
    };
    await (await getDb()).put("auditEvents", row);
    return row;
  },
  async byDocument(documentId: string): Promise<AuditEvent[]> {
    const rows = await (await getDb()).getAllFromIndex(
      "auditEvents",
      "documentId",
      documentId,
    );
    return rows.sort((a, b) => a.at.localeCompare(b.at));
  },
  async deleteByDocument(documentId: string): Promise<void> {
    const db = await getDb();
    const rows = await db.getAllFromIndex("auditEvents", "documentId", documentId);
    const tx = db.transaction("auditEvents", "readwrite");
    await Promise.all(rows.map((row) => tx.store.delete(row.id)));
    await tx.done;
  },
};
