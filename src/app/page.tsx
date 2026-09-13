"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dropzone } from "@/components/upload/Dropzone";
import { sniffFile, rejectReason } from "@/lib/pipeline/fileSniff";
import { documentsRepo } from "@/lib/storage/documentsRepo";
import { useDocuments } from "@/lib/store/DocumentsProvider";
import { IN_PROGRESS_STATUSES, STATUS_LABELS, type DocumentRecord } from "@/lib/types";
import { enhanceDocumentWithAI } from "@/lib/cloudExtract/enhanceDocument";
import { useToast } from "@/components/ui/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { useCloudAssist } from "@/lib/hooks/useCloudAssist";

export default function DashboardPage() {
  const router = useRouter();
  const { documents, ready, ingestFiles, refresh } = useDocuments();
  const { toast } = useToast();
  const [rejects, setRejects] = useState<string[]>([]);
  const [cloudEnabled, setCloudEnabled] = useCloudAssist();
  const [enhancingId, setEnhancingId] = useState<string | null>(null);

  const handleToggleCloud = (checked: boolean) => {
    setCloudEnabled(checked);
    if (checked) {
      toast.success(
        "Gemini Cloud Assist enabled. Click 'Enhance with AI' on any document.",
        "✨ Cloud Assist Active",
      );
    } else {
      toast.info(
        "Cloud Assist disabled. All parsing runs 100% locally in browser.",
        "Local Mode",
      );
    }
  };

  const handleEnhance = async (doc: DocumentRecord) => {
    if (enhancingId) return;
    setEnhancingId(doc.id);
    const toastId = toast.loading(
      `Parsing "${doc.filename}" with Gemini AI...`,
      "AI Enhancement",
    );

    try {
      const result = await enhanceDocumentWithAI(doc);
      await refresh();
      toast.dismiss(toastId);

      if (result.success) {
        toast.success(
          `Enhanced "${doc.filename}"! ${
            result.sectionsCount > 0
              ? `Extracted ${result.sectionsCount} section(s) & ${result.newFieldsCount} new field(s).`
              : `Added ${result.newFieldsCount} new field(s).`
          }`,
          "Success",
        );
      } else {
        toast.error(
          result.error || "Check GEMINI_API_KEY configuration in .env.local",
          "AI Enhancement Failed",
        );
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(
        err instanceof Error ? err.message : "AI Enhancement error",
        "Error",
      );
    } finally {
      setEnhancingId(null);
    }
  };

  const onFiles = async (files: File[]) => {
    const localRejects: string[] = [];
    const accepted: File[] = [];
    const uploadToastId = toast.loading(
      `Processing ${files.length} file(s)...`,
      "Document Import",
    );

    try {
      for (const file of files) {
        const kind = await sniffFile(file);
        const reason = rejectReason(file, kind);
        if (reason) localRejects.push(reason);
        else accepted.push(file);
      }
      const pipelineRejects = await ingestFiles(accepted);
      const allRejects = [...localRejects, ...pipelineRejects];
      setRejects(allRejects);
      toast.dismiss(uploadToastId);

      const successfulCount = Math.max(0, accepted.length - pipelineRejects.length);

      if (successfulCount > 0) {
        toast.success(
          `Successfully processed ${successfulCount} file(s).`,
          "Processing Complete",
        );
      } else if (allRejects.length > 0 && !allRejects.some((r) => r.includes("::"))) {
        toast.error(
          allRejects[0] ?? "Document import failed.",
          "Import Error",
        );
      }

      const dup = allRejects.find((r) => r.includes("::"));
      if (dup) {
        router.push(`/document/${dup.split("::")[1]}`);
        return;
      }

      if (successfulCount > 0) {
        const allDocs = await documentsRepo.all();
        if (allDocs[0]) {
          router.push(`/document/${allDocs[0].id}`);
        }
      }
    } catch (err) {
      toast.dismiss(uploadToastId);
      const errMsg = err instanceof Error ? err.message : "Upload failed unexpectedly.";
      toast.error(errMsg, "Import Error");
      setRejects([...localRejects, errMsg]);
    }
  };

  const done = documents.filter((d) => d.status === "done");
  const avg =
    done.length === 0
      ? "—"
      : `${Math.round(
          done.reduce((s, d) => s + (d.quality?.extractionConfidence ?? 0), 0) /
            Math.max(done.length, 1),
        )}%`;
  const pages = documents.reduce((s, d) => s + (d.pageCount ?? 1), 0);

  return (
    <div className="page-pad dash">
      {/* Stats Cards */}
      <div className="stat-row">
        <article className="stat-card">
          <span className="kind-label">Documents</span>
          <strong>{documents.length}</strong>
          <p className="muted">stored in this browser</p>
        </article>
        <article className="stat-card">
          <span className="kind-label">Avg. confidence</span>
          <strong>{avg}</strong>
          <p className="muted">completed extractions</p>
        </article>
        <article className="stat-card">
          <span className="kind-label">Pages processed</span>
          <strong>{pages}</strong>
          <p className="muted">across all files</p>
        </article>
      </div>

      {/* Interactive Dropzone Hero */}
      <section className="upload-hero" style={{ padding: "var(--space-4)", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "var(--space-3)" }}>
          <div>
            <h1 className="group-title" style={{ margin: 0, fontSize: "1.25rem" }}>Upload &amp; Inspect Documents</h1>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
              Drop a PDF, Word, or text file. Extraction executes 100% in your browser.
            </p>
          </div>
          {/* Cloud Assist Toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: "var(--color-bg-card, #fff)", padding: "6px 14px", borderRadius: 20, border: "1px solid var(--color-border, #e2e8f0)" }}>
            <span>✨ AI Cloud Assist:</span>
            <input
              type="checkbox"
              checked={cloudEnabled}
              onChange={(e) => handleToggleCloud(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#3b82f6" }}
            />
            <span style={{ color: cloudEnabled ? "#166534" : "#64748b" }}>{cloudEnabled ? "ON" : "OFF"}</span>
          </label>
        </div>

        <Dropzone compact={documents.length > 0} onFiles={(files) => void onFiles(files)} />

        {rejects.map((msg) => {
          const [text, id] = msg.split("::");
          return (
            <div key={msg} className="reject-msg" style={{ marginTop: "var(--space-2)" }}>
              {text} {id ? <Link href={`/document/${id}`}>Open document</Link> : null}
            </div>
          );
        })}
      </section>

      {/* Feature Grid */}
      <section className="about-grid">
        <article>
          <h2 className="group-title">100% Local Privacy</h2>
          <p className="muted">
            Document Inspector parses PDFs and text in your browser, extracting key values and unlabeled notes.
          </p>
        </article>
        <article>
          <h2 className="group-title">✨ Gemini AI Cloud Assist</h2>
          <p className="muted">
            Enhance extractions on-demand using Gemini 3.6 Flash. AI infers schema-free sections, table line items, and custom attributes without server uploads by default.
          </p>
        </article>
        <article>
          <h2 className="group-title">Quick Workflow</h2>
          <ol className="about-steps muted">
            <li>Drop any file into the hero dropzone above.</li>
            <li>Click &quot;Enhance with AI&quot; to pull structured section trees.</li>
            <li>Review and edit fields live in the document inspector.</li>
            <li>Download corrected documents or export structured data in JSON, CSV, and Excel (.xlsx) formats.</li>
          </ol>
        </article>
      </section>

      {/* Documents List with AI Enhancement Actions */}
      <section style={{ marginTop: "var(--space-5)" }}>
        <div className="section-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 className="group-title" style={{ margin: 0 }}>Recent Documents</h2>
          <Link href="/history" style={{ fontSize: "0.85rem", color: "var(--color-primary, #3b82f6)", textDecoration: "none", fontWeight: 600 }}>
            See all in history →
          </Link>
        </div>

        {!ready ? (
          <div style={{ marginTop: 12 }}>
            <SkeletonTableRows rows={3} />
          </div>
        ) : documents.length === 0 ? (
          <p className="muted empty-docs">
            No documents yet. Drop your first PDF, Word, or text file above.
          </p>
        ) : (
          <ul className="doc-list">
            {documents.slice(0, 8).map((doc) => {
              const isEnhancing = enhancingId === doc.id;
              const hasCloud = doc.cloudAssistStatus === "succeeded";
              const cloudFailed = doc.cloudAssistStatus === "failed-fell-back";
              return (
                <li
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--color-border, #e2e8f0)",
                    marginBottom: 8,
                    background: "var(--color-bg-card, #ffffff)",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <Link
                    href={`/document/${doc.id}`}
                    style={{ textDecoration: "none", flex: 1, minWidth: 200 }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--color-text, #0f172a)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {doc.filename}
                    </div>
                    <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                      {IN_PROGRESS_STATUSES.includes(doc.status)
                        ? doc.statusDetail ?? STATUS_LABELS[doc.status]
                        : `${doc.quality?.extractionConfidence ?? "—"}% confidence · ${doc.documentType ?? "Document"}`}
                      {hasCloud ? " · ✨ AI Enhanced" : null}
                      {cloudFailed ? " · ⚠️ AI Failed" : null}
                    </div>
                  </Link>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={isEnhancing}
                      onClick={() => void handleEnhance(doc)}
                      style={{
                        padding: "6px 14px",
                        fontSize: "0.825rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: hasCloud
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                        color: hasCloud ? "#475569" : "#ffffff",
                        border: hasCloud ? "1px solid #cbd5e1" : "none",
                        cursor: isEnhancing ? "not-allowed" : "pointer",
                        borderRadius: 6,
                      }}
                    >
                      {isEnhancing ? (
                        <>
                          <Spinner size="sm" color={hasCloud ? "#475569" : "#ffffff"} />
                          <span>Enhancing…</span>
                        </>
                      ) : hasCloud ? (
                        <>✨ Re-Enhance</>
                      ) : (
                        <>✨ Enhance with AI</>
                      )}
                    </button>

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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
