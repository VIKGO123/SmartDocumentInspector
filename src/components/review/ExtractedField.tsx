"use client";

import { useRef, useState } from "react";
import type { Block, DocumentRecord, FieldRecord } from "@/lib/types";
import { resolveFieldBBox } from "@/lib/pipeline/extraction/locate";
import { validateFieldValue } from "@/lib/pipeline/extraction/patterns";
import { applyDocumentReplacement } from "@/lib/pipeline/rewrite/applyDocumentReplacement";
import { fieldsRepo } from "@/lib/storage/fieldsRepo";
import { auditRepo } from "@/lib/storage/auditRepo";

interface Props {
  field: FieldRecord;
  blocks: Block[];
  active: boolean;
  onHover: () => void;
  onChange: (field: FieldRecord) => void;
  onDocumentUpdated?: (doc: DocumentRecord) => void;
  onConfirm: (flagged: boolean) => void;
  searchHit?: boolean;
  searchCurrent?: boolean;
}

export function ExtractedField({
  field,
  blocks,
  active,
  onHover,
  onChange,
  onDocumentUpdated,
  onConfirm,
  searchHit = false,
  searchCurrent = false,
}: Props) {
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<number>(0);

  const confidencePct = Math.round(field.confidence * 100);
  const tierClass = field.tier ? `tier-${field.tier}` : confidencePct >= 80 ? "tier-high" : confidencePct >= 50 ? "tier-medium" : "tier-low";

  const commit = async (value: string) => {
    if (value === field.value) return;
    if (!value.trim() && field.required) {
      setInvalid(true);
      return;
    }
    const ok = !value.trim() || validateFieldValue(field.valueType, value);
    setInvalid(!ok);
    if (!ok) return;
    try {
      const next = await fieldsRepo.edit(field.id, value);
      if (!next) return;
      const patched = await applyDocumentReplacement({
        documentId: field.documentId,
        oldValue: field.value,
        newValue: value,
        bbox: resolveFieldBBox(field, blocks),
      });
      await auditRepo.add({
        documentId: field.documentId,
        kind: "edit",
        label: `${field.key} corrected`,
        oldValue: field.value,
        newValue: value,
      });
      onChange(next);
      if (patched) onDocumentUpdated?.(patched);
    } catch (err) {
      console.error("Field save failed", err);
      setInvalid(true);
    }
  };

  return (
    <div
      id={`match-field-${field.id}`}
      className={`snap-field-card ${active ? "is-active" : ""} ${field.flagged ? "is-flagged" : ""} ${searchHit ? "is-search-hit" : ""} ${searchCurrent ? "is-search-current" : ""}`}
      onMouseEnter={onHover}
      onMouseOver={onHover}
      onFocusCapture={onHover}
    >
      <div className="field-card-header">
        <span className="field-label-name">{field.key}</span>
        <span className={`field-conf-badge ${tierClass}`}>
          {confidencePct}%
        </span>
      </div>

      <input
        className={`field-card-input ${invalid ? "is-invalid" : ""}`}
        aria-label={`Edit ${field.key}`}
        defaultValue={field.value}
        onChange={(e) => {
          const value = e.target.value;
          setInvalid(Boolean(value.trim()) && !validateFieldValue(field.valueType, value));
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            void commit(value);
          }, 350);
        }}
        onBlur={(e) => {
          window.clearTimeout(timer.current);
          void commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            window.clearTimeout(timer.current);
            void commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            window.clearTimeout(timer.current);
            (e.target as HTMLInputElement).value = field.value;
            setInvalid(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />

      <div className="field-card-footer">
        <div className="field-tags">
          {field.provenance && field.provenance !== "local" ? (
            <span className={`field-prov-tag ${field.provenance === "cloud-verbatim" ? "is-verbatim" : "is-inferred"}`}>
              {field.provenance === "cloud-verbatim" ? "AI · Verbatim" : "AI · Inferred"}
            </span>
          ) : (
            <span className="field-prov-tag is-local">Local OCR</span>
          )}
          {field.edited ? <span className="field-edited-tag">Edited</span> : null}
        </div>

        <div className="field-action-btns">
          <button
            type="button"
            className={`field-btn confirm-btn ${!field.flagged ? "is-confirmed" : ""}`}
            title="Confirm field accuracy"
            aria-label="Confirm field"
            onClick={() => onConfirm(false)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button
            type="button"
            className={`field-btn flag-btn ${field.flagged ? "is-flagged-active" : ""}`}
            title="Flag field for manual review"
            aria-label="Flag field"
            onClick={() => onConfirm(true)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
