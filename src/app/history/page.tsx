"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDocuments } from "@/lib/store/DocumentsProvider";
import { deleteDocument } from "@/lib/storage/documentsRepo";
import { getStorageEstimate, purgeOrphanedStorage, type StorageEstimate } from "@/lib/storage/storageQuota";
import { IN_PROGRESS_STATUSES, STATUS_LABELS } from "@/lib/types";
import { useToast } from "@/components/ui/ToastProvider";
import { SkeletonTableRows } from "@/components/ui/Skeleton";

export default function HistoryPage() {
  const { documents, ready, refresh } = useDocuments();
  const router = useRouter();
  const { toast } = useToast();
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const updateStorage = useCallback(async () => {
    const est = await getStorageEstimate();
    setStorageEstimate(est);
  }, []);

  useEffect(() => {
    let active = true;
    getStorageEstimate().then((est) => {
      if (active) setStorageEstimate(est);
    });
    return () => {
      active = false;
    };
  }, [documents]);

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    try {
      await deleteDocument(docId);
      await refresh();
      await updateStorage();
      toast.info(filename, "Deleted");
      if (documents.length <= 1) router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deletion failed", "Error");
    }
  };

  const handlePurgeOrphans = async () => {
    setCleaning(true);
    try {
      const res = await purgeOrphanedStorage();
      await updateStorage();
      if (res.deletedFiles > 0 || res.deletedFields > 0 || res.deletedAuditEvents > 0) {
        toast.success(
          `Purged ${res.deletedFiles} orphaned files, ${res.deletedFields} fields, and ${res.deletedAuditEvents} events.`,
          "Storage Cleaned",
        );
      } else {
        toast.info("No orphaned storage detected. Database is already clean!", "Storage Clean");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed", "Storage Error");
    } finally {
      setCleaning(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        `Delete all ${documents.length} documents and their stored binaries from this browser? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      for (const doc of documents) {
        await deleteDocument(doc.id);
      }
      await purgeOrphanedStorage();
      await refresh();
      await updateStorage();
      toast.info("All documents and stored files have been cleared.", "Database Reset");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clear failed", "Error");
    }
  };

  return (
    <div className="page-pad" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 className="group-title" style={{ fontSize: "1.75rem", marginBottom: 6 }}>Document History</h1>
          <p className="muted" style={{ fontSize: "0.95rem" }}>
            Every file processed in this browser. Deleting removes it permanently.
          </p>
        </div>

        {ready && documents.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => void handlePurgeOrphans()}
              disabled={cleaning}
              style={{
                fontSize: "0.8rem",
                padding: "6px 12px",
                borderRadius: 6,
                cursor: cleaning ? "wait" : "pointer",
              }}
            >
              {cleaning ? "Cleaning…" : "🧹 Clean Cache"}
            </button>
            <button
              type="button"
              className="ghost-btn danger"
              onClick={() => void handleClearAll()}
              style={{
                fontSize: "0.8rem",
                padding: "6px 12px",
                color: "#ef4444",
                borderColor: "#fecaca",
                background: "#fef2f2",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Clear All Documents
            </button>
          </div>
        )}
      </div>

      {/* Storage Estimate Banner */}
      {storageEstimate && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 20,
            background: "var(--color-bg-subtle, #f8fafc)",
            border: "1px solid var(--color-border, #e2e8f0)",
            fontSize: "0.825rem",
            color: "var(--color-muted, #64748b)",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--color-text, #0f172a)" }}>
              💾 Local Storage:
            </span>
            <span>
              {storageEstimate.usageMB} MB of {storageEstimate.quotaMB} MB used ({storageEstimate.percentUsed}%)
            </span>
            {storageEstimate.isPersistent && (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "#dcfce7",
                  color: "#166534",
                  fontWeight: 600,
                }}
              >
                Persistent
              </span>
            )}
          </div>
          {storageEstimate.percentUsed > 80 && (
            <span style={{ color: "#b45309", fontWeight: 600 }}>
              ⚠️ Storage approaching quota. Delete unused documents to prevent upload failures.
            </span>
          )}
        </div>
      )}

      {!ready ? (
        <SkeletonTableRows rows={4} />
      ) : documents.length === 0 ? (
        <p className="muted empty-docs">
          No documents yet. <Link href="/" style={{ color: "var(--color-primary, #3b82f6)", fontWeight: 600 }}>Upload your first document →</Link>
        </p>
      ) : (
        <ul className="doc-list">
          {documents.map((doc) => (
            <li
              key={doc.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--color-border, #e2e8f0)",
                marginBottom: 10,
                background: "var(--color-bg-card, #ffffff)",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <Link
                href={`/document/${doc.id}`}
                style={{
                  textDecoration: "none",
                  flex: 1,
                  minWidth: 200,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span className="filename" style={{ fontWeight: 600, color: "var(--color-text, #0f172a)" }}>
                  {doc.filename}
                </span>
                <span className="muted" style={{ fontSize: "0.825rem" }}>
                  {IN_PROGRESS_STATUSES.includes(doc.status)
                    ? STATUS_LABELS[doc.status]
                    : `${doc.quality?.extractionConfidence ?? "—"}% confidence · ${new Date(doc.uploadedAt).toLocaleString()}`}
                  {doc.cloudAssistStatus === "succeeded" ? " · ✨ AI Enhanced" : null}
                  {doc.cloudAssistStatus === "pending" ? " · ✨ AI Enhancing…" : null}
                </span>
              </Link>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Link
                  href={`/document/${doc.id}`}
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-primary, #3b82f6)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Inspect →
                </Link>
                <button
                  type="button"
                  className="ghost-btn danger"
                  onClick={() => void handleDelete(doc.id, doc.filename)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    color: "#ef4444",
                    borderColor: "#fecaca",
                    background: "#fef2f2",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
