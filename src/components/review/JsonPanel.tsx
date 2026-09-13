"use client";

import { useEffect, useMemo, useState } from "react";
import type { PapersnapJson } from "@/lib/pipeline/extraction/json";
import { downloadCsv, downloadExcel, downloadJson } from "@/lib/pipeline/extraction/json";
import { countOccurrences, escapeRegExp } from "@/lib/search/textMatch";
import { useToast } from "@/components/ui/ToastProvider";

export function JsonPanel({
  payload,
  query = "",
  activeHit = 0,
}: {
  payload: PapersnapJson;
  query?: string;
  activeHit?: number;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const text = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const hits = countOccurrences(text, query);
  const parts = useMemo(() => splitHighlight(text, query), [text, query]);

  const byteSize = useMemo(() => {
    const bytes = new Blob([text]).size;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }, [text]);

  useEffect(() => {
    if (!query.trim() || hits === 0) return;
    const el = document.getElementById(`json-hit-${activeHit}`);
    el?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [query, hits, activeHit, text]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("JSON copied to clipboard", "Copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy JSON to clipboard", "Copy Error");
    }
  };

  return (
    <div className="json-panel">
      <div className="json-panel-header">
        <div className="json-header-info">
          <span className="json-tag">⚡ JSON</span>
          <span className="json-size">{byteSize}</span>
          {query.trim() ? (
            <span className="json-matches-badge">
              {hits} match{hits === 1 ? "" : "es"}
            </span>
          ) : null}
        </div>
        <div className="json-header-actions">
          <button
            type="button"
            className={`json-action-btn ${copied ? "is-copied" : ""}`}
            onClick={() => void copyToClipboard()}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy JSON</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="json-action-btn"
            title="Download JSON format"
            onClick={() => {
              downloadJson(payload, payload.documentId);
              toast.success("JSON document downloaded", "Downloaded");
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>JSON</span>
          </button>
          <button
            type="button"
            className="json-action-btn"
            title="Download CSV format"
            onClick={() => {
              downloadCsv(payload, payload.documentId);
              toast.success("CSV spreadsheet downloaded", "Downloaded");
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>CSV</span>
          </button>
          <button
            type="button"
            className="json-action-btn"
            title="Download Excel (.xlsx) format"
            onClick={async () => {
              try {
                await downloadExcel(payload, payload.documentId);
                toast.success("Excel spreadsheet downloaded", "Downloaded");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Excel export failed", "Error");
              }
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Excel</span>
          </button>
        </div>
      </div>
      <div className="json-code-wrapper">
        <pre className="json-pre">
          {parts.map((part, i) =>
            part.hit ? (
              <mark
                key={i}
                id={`json-hit-${part.hitIndex}`}
                className={part.hitIndex === activeHit ? "is-current" : undefined}
              >
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </pre>
      </div>
    </div>
  );
}

function splitHighlight(
  text: string,
  query: string,
): { text: string; hit: boolean; hitIndex?: number }[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  let hitIndex = 0;
  return text.split(re).filter(Boolean).map((chunk) => {
    const hit = chunk.toLowerCase() === q.toLowerCase();
    if (!hit) return { text: chunk, hit: false };
    const next = { text: chunk, hit: true, hitIndex };
    hitIndex += 1;
    return next;
  });
}
