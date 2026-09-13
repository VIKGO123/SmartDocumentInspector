"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentNote } from "@/components/review/DocumentNote";
import { ExtractedField } from "@/components/review/ExtractedField";
import { JsonPanel } from "@/components/review/JsonPanel";
import { QualityDashboard } from "@/components/review/QualityDashboard";
import { PageViewer } from "@/components/review/PageViewer";
import { SearchMatchBar } from "@/components/review/SearchMatchBar";
import {
  downloadCsv,
  downloadExcel,
  downloadJson,
  toPapersnapJson,
} from "@/lib/pipeline/extraction/json";
import { resolveFieldBBox, resolveTextBBox } from "@/lib/pipeline/extraction/locate";
import { partitionDocumentContent } from "@/lib/pipeline/extraction/partitionContent";
import {
  applyDocumentReplacement,
  downloadStoredDocument,
} from "@/lib/pipeline/rewrite/applyDocumentReplacement";
import { rescanDocument } from "@/lib/pipeline/runPipeline";
import { countOccurrences, matchesQuery, wrapIndex } from "@/lib/search/textMatch";
import { fieldsRepo } from "@/lib/storage/fieldsRepo";
import { deleteDocument, documentsRepo } from "@/lib/storage/documentsRepo";
import { useDocument } from "@/lib/store/DocumentsProvider";
import { useCloudAssist } from "@/lib/hooks/useCloudAssist";
import { enhanceDocumentWithAI } from "@/lib/cloudExtract/enhanceDocument";
import { IN_PROGRESS_STATUSES, STATUS_LABELS, type FieldRecord } from "@/lib/types";
import { useToast } from "@/components/ui/ToastProvider";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonTableRows } from "@/components/ui/Skeleton";

export default function DocumentWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const rawDocId = params?.docId ?? params?.id;
  const docId = Array.isArray(rawDocId) ? rawDocId[0] : (rawDocId ?? "");
  const { ready, document, fields, refresh, updateField, updateDocument } = useDocument(
    docId,
  );
  const [tab, setTab] = useState<"fields" | "quality" | "json">("fields");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [cloudEnabled] = useCloudAssist();
  const [cloudLoading, setCloudLoading] = useState(false);
  const [rescanLoading, setRescanLoading] = useState(false);
  const [mobileView, setMobileView] = useState<"both" | "preview" | "inspector">("both");
  const [showHint, setShowHint] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [frozenNotes, setFrozenNotes] = useState<{
    id: string;
    rescans: number;
    notes: string[];
  } | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      globalThis.document.addEventListener("mousedown", handleClickOutside);
      return () => globalThis.document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportOpen]);

  const payload = useMemo(() => {
    if (!document) return null;
    const json = toPapersnapJson(document, fields ?? []);
    const notesForJson =
      frozenNotes?.id === document.id && frozenNotes.rescans === (document.rescans ?? 0)
        ? frozenNotes.notes
        : json.notes;
    return { ...json, notes: notesForJson };
  }, [document, fields, frozenNotes]);

  const partitioned = useMemo(
    () =>
      document
        ? partitionDocumentContent(fields ?? [], document.blockTree ?? [], document.notes ?? [])
        : { fields: [], notes: [] },
    [document, fields],
  );

  const named = useMemo(() => {
    // Shared helpers (mirrors json.ts logic for consistency)
    const TIMEZONE_CODES = new Set([
      "ist", "pst", "est", "cst", "mst", "gmt", "utc", "bst",
      "aest", "hst", "jst", "cet", "eet", "wat", "eat",
    ]);
    const isNoise = (f: FieldRecord) => {
      const val = f.value.trim();
      if (!val) return false;
      if (f.valueType === "location" && TIMEZONE_CODES.has(val.toLowerCase())) return true;
      if (f.valueType === "location" && val.length <= 3) return true;
      if (/^[^,]{1,30},$/.test(val)) return true;
      return false;
    };

    const order = payload?.fields.map((f) => f.key) ?? [];
    const sorted = [...partitioned.fields].sort((a, b) => {
      const ai = order.indexOf(a.schemaKey ?? "");
      const bi = order.indexOf(b.schemaKey ?? "");
      if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    // Step 1: Remove noise fields
    const cleaned = sorted.filter((f) => f.value?.trim() ? !isNoise(f) : true);

    // Step 2: Exact-value dedup (prefer non-numbered label, then higher confidence)
    const valueMap = new Map<string, FieldRecord>();
    for (const f of cleaned) {
      if (!f.value?.trim()) continue;
      const normVal = f.value.trim().toLowerCase().replace(/\s+/g, " ");
      const existing = valueMap.get(normVal);
      if (!existing) {
        valueMap.set(normVal, f);
      } else {
        const existingNumbered = /\(\d+\)$/.test(existing.key);
        const fNumbered = /\(\d+\)$/.test(f.key);
        if (existingNumbered && !fNumbered) {
          valueMap.set(normVal, f);
        } else if (!existingNumbered && fNumbered) {
          // keep existing
        } else if (f.confidence > existing.confidence) {
          valueMap.set(normVal, f);
        }
      }
    }

    // Step 3: Containment dedup — suppress shorter values that are substrings of longer ones
    const winners = [...valueMap.values()];
    const suppressedIds = new Set<string>();
    for (const a of winners) {
      if (suppressedIds.has(a.id)) continue;
      const aNorm = a.value.trim().toLowerCase().replace(/\s+/g, " ");
      for (const b of winners) {
        if (a.id === b.id || suppressedIds.has(b.id)) continue;
        const bNorm = b.value.trim().toLowerCase().replace(/\s+/g, " ");
        if (bNorm.includes(aNorm) && aNorm.length >= 4 && aNorm.length / bNorm.length >= 0.4) {
          suppressedIds.add(a.id);
          break;
        }
      }
    }

    return cleaned.filter((f) => {
      if (!f.value?.trim()) return true;
      const normVal = f.value.trim().toLowerCase().replace(/\s+/g, " ");
      const winner = valueMap.get(normVal);
      return winner?.id === f.id && !suppressedIds.has(f.id);
    });
  }, [partitioned.fields, payload]);

  const notes = useMemo(() => {
    if (
      document &&
      frozenNotes?.id === document.id &&
      frozenNotes.rescans === (document.rescans ?? 0)
    ) {
      return frozenNotes.notes;
    }
    return partitioned.notes;
  }, [document, frozenNotes, partitioned.notes]);

  const q = query.trim();
  const fieldHits = useMemo(
    () => named.filter((field) => matchesQuery(query, field.key, field.value)),
    [named, query],
  );
  const noteHits = useMemo(
    () =>
      notes
        .map((note, index) => ({ note, index }))
        .filter((item) => matchesQuery(query, item.note)),
    [notes, query],
  );
  const jsonHits = useMemo(
    () => (payload ? countOccurrences(JSON.stringify(payload, null, 2), query) : 0),
    [payload, query],
  );
  const matchCount =
    tab === "json" ? jsonHits : tab === "fields" ? fieldHits.length + noteHits.length : 0;
  const currentMatch = matchCount ? wrapIndex(matchIndex, matchCount) : 0;
  const fieldHit =
    q && tab === "fields" && currentMatch < fieldHits.length ? fieldHits[currentMatch] : undefined;
  const noteHit =
    q && tab === "fields" && currentMatch >= fieldHits.length
      ? noteHits[currentMatch - fieldHits.length]
      : undefined;
  const searchActiveId = fieldHit
    ? fieldHit.id
    : noteHit
      ? `note-${noteHit.index}`
      : activeId;
  const searchPage = fieldHit
    ? resolveFieldBBox(fieldHit, document?.blockTree ?? []).page
    : noteHit
      ? resolveTextBBox(noteHit.note, document?.blockTree ?? [])?.page
      : undefined;
  const previewPage = searchPage || page;

  useEffect(() => {
    if (!q || tab !== "fields" || matchCount === 0) return;
    const id = fieldHit ? `match-field-${fieldHit.id}` : `match-note-${noteHit?.index}`;
    globalThis.document.getElementById(id)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [q, tab, currentMatch, matchCount, fieldHit, noteHit]);

  if (!ready) {
    return (
      <div className="page-pad" style={{ maxWidth: 800, margin: "24px auto" }}>
        <p className="muted" style={{ marginBottom: 16 }}>Loading document inspector...</p>
        <SkeletonTableRows rows={5} />
      </div>
    );
  }
  if (!document) {
    return (
      <div className="page-pad">
        <p>This document is not in IndexedDB on this device.</p>
        <Link href="/history">Back to history</Link>
      </div>
    );
  }

  const current = document;
  const busy = IN_PROGRESS_STATUSES.includes(current.status);
  const pct = payload?.confidence ?? current.quality?.extractionConfidence ?? 0;
  const pages = current.pageCount ?? 1;
  const extraHighlights =
    searchActiveId?.startsWith("note-")
      ? (() => {
          const note = notes[Number(searchActiveId.slice(5))];
          const bbox = note ? resolveTextBBox(note, current.blockTree) : null;
          return bbox ? [{ id: searchActiveId, bbox }] : [];
        })()
      : [];

  function hoverField(id: string) {
    setActiveId(id);
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    const box = resolveFieldBBox(field, current.blockTree);
    if (box.page && box.page !== page) setPage(box.page);
  }

  function hoverNote(index: number) {
    setActiveId(`note-${index}`);
    const bbox = resolveTextBBox(notes[index] ?? "", current.blockTree);
    if (bbox?.page && bbox.page !== page) setPage(bbox.page);
  }

  function stepMatch(delta: number) {
    if (matchCount === 0) return;
    setMatchIndex((i) => wrapIndex(i + delta, matchCount));
  }

  const currentFieldId =
    tab === "fields" && q && currentMatch < fieldHits.length
      ? fieldHits[currentMatch]?.id
      : null;
  const currentNoteIndex =
    tab === "fields" && q && currentMatch >= fieldHits.length
      ? noteHits[currentMatch - fieldHits.length]?.index
      : undefined;

  return (
    <div className="workspace">
      {/* Top Header Navigation with Breadcrumb & Back Button */}
      <div className="workspace-breadcrumb-bar">
        <Link href="/history" className="history-back-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to History</span>
        </Link>
        <span className="breadcrumb-divider">/</span>
        <span className="breadcrumb-filename">{current.filename}</span>
      </div>

      <header className="workspace-top">
        <div className="workspace-doc-meta">
          <div className="workspace-title-row">
            <h1 className="doc-main-title">{current.filename}</h1>
            <span className={`doc-status-badge ${busy ? "is-busy" : "is-ready"}`}>
              <span className={`status-dot ${busy ? "pulse" : "check"}`} />
              {busy ? (current.statusDetail ?? STATUS_LABELS[current.status]) : "Ready"}
            </span>
          </div>
          <div className="doc-meta-pills">
            <span className="meta-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {current.documentType ?? "Document"}
            </span>
            <span className="meta-pill conf-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {pct}% Confidence
            </span>
            <span className="meta-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
              {pages} page{pages === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="workspace-actions">
          {cloudEnabled && current.cloudAssistStatus !== "succeeded" ? (
            <button
              type="button"
              className="ghost-btn"
              disabled={busy || cloudLoading || rescanLoading}
              style={{
                borderColor: "var(--color-primary, #2563eb)",
                color: "var(--color-primary, #2563eb)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onClick={() => void runCloudEnhance()}
            >
              {cloudLoading ? (
                <>
                  <Spinner size="sm" color="var(--color-primary, #2563eb)" />
                  <span>Enhancing with AI…</span>
                </>
              ) : (
                <>✨ Enhance with AI</>
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            disabled={busy || cloudLoading || rescanLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => void rescan()}
          >
            {rescanLoading ? (
              <>
                <Spinner size="sm" />
                <span>Rescanning…</span>
              </>
            ) : (
              <>🔄 Rescan</>
            )}
          </button>
          <div className="export-dropdown-container" ref={exportRef}>
            <button
              type="button"
              className="ghost-btn export-trigger-btn"
              disabled={!payload}
              onClick={() => setExportOpen((prev) => !prev)}
              aria-expanded={exportOpen}
              aria-haspopup="true"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {exportOpen && payload && (
              <div className="export-menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  onClick={() => {
                    downloadJson(payload, current.filename);
                    toast.success("JSON export downloaded successfully", "Exported");
                    setExportOpen(false);
                  }}
                >
                  <span className="export-badge json-badge">JSON</span>
                  <div className="export-label-group">
                    <span className="export-format-name">JSON Document</span>
                    <span className="export-format-desc">Raw schema & extracted payload (.json)</span>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  onClick={() => {
                    downloadCsv(payload, current.filename);
                    toast.success("CSV spreadsheet downloaded successfully", "Exported");
                    setExportOpen(false);
                  }}
                >
                  <span className="export-badge csv-badge">CSV</span>
                  <div className="export-label-group">
                    <span className="export-format-name">CSV Spreadsheet</span>
                    <span className="export-format-desc">Tabular data with UTF-8 BOM (.csv)</span>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="export-menu-item"
                  onClick={async () => {
                    const tid = toast.loading("Generating Excel workbook...", "Excel Export");
                    try {
                      await downloadExcel(payload, current.filename);
                      toast.dismiss(tid);
                      toast.success("Excel workbook downloaded successfully", "Exported");
                    } catch (err) {
                      toast.dismiss(tid);
                      toast.error(err instanceof Error ? err.message : "Export failed", "Export Error");
                    } finally {
                      setExportOpen(false);
                    }
                  }}
                >
                  <span className="export-badge excel-badge">XLSX</span>
                  <div className="export-label-group">
                    <span className="export-format-name">Excel Workbook</span>
                    <span className="export-format-desc">Multi-sheet spreadsheet (.xlsx)</span>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={() => {
              void downloadStoredDocument(current.id);
              toast.info("Downloading stored document file...", "Download");
            }}
          >
            Download
          </button>
          <button type="button" className="ghost-btn danger" onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </header>

      {/* Responsive View Selector Bar for smaller screens */}
      <div className="responsive-view-bar">
        <button
          type="button"
          className={mobileView === "preview" ? "active" : ""}
          onClick={() => setMobileView("preview")}
        >
          📄 PDF Document
        </button>
        <button
          type="button"
          className={mobileView === "inspector" ? "active" : ""}
          onClick={() => setMobileView("inspector")}
        >
          📋 Inspector ({tab === "fields" ? `Fields ${named.length}` : tab === "quality" ? "Quality" : "Raw JSON"})
        </button>
        <button
          type="button"
          className={mobileView === "both" ? "active" : ""}
          onClick={() => setMobileView("both")}
        >
          🌗 Split View
        </button>
      </div>

      <div className="workspace-split">
        <section
          className="workspace-preview"
          style={{
            display: mobileView === "inspector" ? "none" : undefined,
          }}
        >
          <div className="preview-bar">
            <span className="preview-bar-name">{current.filename}</span>
            <div className="preview-bar-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => void downloadStoredDocument(current.id)}
              >
                Download
              </button>
              <span>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={previewPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>{" "}
                {previewPage} / {pages}{" "}
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={previewPage >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </span>
            </div>
          </div>
          <PageViewer
            documentId={current.id}
            mimeType={current.mimeType}
            fileRevision={current.fileRevision}
            fields={fields}
            blocks={current.blockTree}
            mode="fields"
            activeId={searchActiveId}
            onSelect={hoverField}
            page={previewPage}
            extraHighlights={extraHighlights}
          />
        </section>

        <aside
          className="workspace-side"
          style={{
            display: mobileView === "preview" ? "none" : undefined,
          }}
        >
          {/* Segmented Control Tabs */}
          <div className="view-toggle" role="tablist" aria-label="Document inspector tabs">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "fields"}
              className={`segmented-tab ${tab === "fields" ? "is-active" : ""}`}
              onClick={() => { setTab("fields"); setMatchIndex(0); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Fields</span>
              <span className="tab-pill-badge">{named.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "quality"}
              className={`segmented-tab ${tab === "quality" ? "is-active" : ""}`}
              onClick={() => { setTab("quality"); setMatchIndex(0); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Quality</span>
              <span className="tab-dot-badge" style={{ background: pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444" }} />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "json"}
              className={`segmented-tab ${tab === "json" ? "is-active" : ""}`}
              onClick={() => { setTab("json"); setMatchIndex(0); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>Raw JSON</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="workspace-search">
            <div className="search-input-header">
              <label className="kind-label" htmlFor="doc-search">
                Find in Document
              </label>
              <button
                type="button"
                className="search-help-btn"
                onClick={() => setShowHint((prev) => !prev)}
                title="Toggle search help"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Help</span>
              </button>
            </div>
            <div className="search-input-wrapper">
              <svg className="search-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                id="doc-search"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    stepMatch(e.shiftKey ? -1 : 1);
                  }
                }}
                placeholder="Search fields, notes & JSON..."
              />
            </div>
            <SearchMatchBar
              query={query}
              count={matchCount}
              index={currentMatch}
              onPrev={() => stepMatch(-1)}
              onNext={() => stepMatch(1)}
            />
            {showHint ? (
              <p className="muted workspace-hint is-expanded">
                Named values appear as Fields. Unlabeled text is under Document notes. Enter jumps to
                the next match; Shift+Enter goes back. Hover a field or note to highlight it on the
                page.
              </p>
            ) : null}
          </div>

          {/* Tab Contents */}
          {tab === "fields" ? (
            <div className="extracted-list">
              <div className="kind-label">
                Fields ({named.length})
                {q ? ` · ${fieldHits.length} matching` : ""}
              </div>
              {named.map((field) => (
                <ExtractedField
                  key={field.id}
                  field={field}
                  blocks={current.blockTree}
                  active={searchActiveId === field.id}
                  searchHit={q ? matchesQuery(query, field.key, field.value) : false}
                  searchCurrent={currentFieldId === field.id}
                  onHover={() => hoverField(field.id)}
                  onChange={updateField}
                  onDocumentUpdated={updateDocument}
                  onConfirm={(flagged) => void thumb(field.id, flagged)}
                />
              ))}
              {named.length === 0 ? (
                <p className="muted">
                  {busy
                    ? document.statusDetail ?? STATUS_LABELS[document.status]
                    : "No named fields yet — unlabeled text is listed under Document notes."}
                </p>
              ) : null}

              <div className="kind-label notes-head">
                Document notes
                {q ? ` · ${noteHits.length} matching` : ` · ${notes.length}`}
              </div>
              {notes.length === 0 ? (
                <p className="muted">No extra unlabeled text from this document.</p>
              ) : (
                <ul className="note-list">
                  {notes.map((note, index) => (
                    <DocumentNote
                      key={`note-${index}`}
                      index={index}
                      note={note}
                      active={searchActiveId === `note-${index}`}
                      searchHit={q ? matchesQuery(query, note) : false}
                      searchCurrent={currentNoteIndex === index}
                      onHover={() => hoverNote(index)}
                      onSave={(value) => void saveNote(index, value)}
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "quality" ? (
            <div className="extracted-list">
              <QualityDashboard
                quality={payload?.quality}
                fieldsCount={named.length}
                notesCount={notes.length}
                filename={current.filename}
              />
            </div>
          ) : null}

          {tab === "json" && payload ? (
            <JsonPanel payload={payload} query={query} activeHit={currentMatch} />
          ) : null}
        </aside>
      </div>
    </div>
  );

  async function rescan() {
    if (rescanLoading) return;
    setRescanLoading(true);
    const tid = toast.loading(`Rescanning ${current.filename}...`, "Rescan");
    try {
      await rescanDocument(current.id);
      await refresh();
      toast.dismiss(tid);
      toast.success("Rescan completed successfully!", "Complete");
    } catch (err) {
      toast.dismiss(tid);
      toast.error(err instanceof Error ? err.message : "Rescan failed", "Rescan Error");
    } finally {
      setRescanLoading(false);
    }
  }

  async function onDelete() {
    if (!confirm(`Delete ${current.filename}?`)) return;
    await deleteDocument(current.id);
    await refresh();
    toast.info(current.filename, "Deleted");
    router.push("/history");
  }

  async function thumb(id: string, flagged: boolean) {
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    const next = { ...field, flagged, edited: field.edited || !flagged };
    await fieldsRepo.put(next);
    updateField(next);
    toast.success(flagged ? "Field flagged for review" : "Field confirmed", "Field Updated");
  }

  async function saveNote(index: number, value: string) {
    if (notes[index] === value) return;
    const previous = notes[index];
    const next = notes.map((item, i) => (i === index ? value : item));
    setFrozenNotes({ id: current.id, rescans: current.rescans ?? 0, notes: next });
    await applyDocumentReplacement({
      documentId: current.id,
      oldValue: previous,
      newValue: value,
      bbox: resolveTextBBox(previous, current.blockTree) ?? undefined,
    });
    const patched = await documentsRepo.patch(current.id, { notes: next });
    if (patched) updateDocument(patched);
    toast.success("Document note saved", "Updated");
  }

  async function runCloudEnhance() {
    if (!current || cloudLoading) return;
    setCloudLoading(true);
    const tid = toast.loading(`Parsing with Gemini AI...`, "AI Cloud Assist");
    try {
      const res = await enhanceDocumentWithAI(current);
      await refresh();
      toast.dismiss(tid);
      if (res.success) {
        toast.success(
          `Extracted ${res.newFieldsCount} new field(s)${res.sectionsCount ? ` across ${res.sectionsCount} section(s)` : ""}.`,
          "AI Enhancement Complete",
        );
      } else {
        toast.error(res.error || "AI Enhancement failed", "Cloud Assist Error");
      }
    } catch (err) {
      toast.dismiss(tid);
      toast.error(err instanceof Error ? err.message : "Cloud assist failed", "Error");
    } finally {
      setCloudLoading(false);
    }
  }
}
