"use client";

import { useState } from "react";
import type { FieldRecord } from "@/lib/types";
import { validateFieldValue } from "@/lib/pipeline/extraction/patterns";
import { fieldsRepo } from "@/lib/storage/fieldsRepo";
import { auditRepo } from "@/lib/storage/auditRepo";

interface Props {
  field: FieldRecord;
  active: boolean;
  onSelect: () => void;
  onChange: (field: FieldRecord) => void;
  cells?: string[][];
}

export function FieldRow({ field, active, onSelect, onChange, cells }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const [invalid, setInvalid] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  const commit = async () => {
    if (!draft.trim() && field.required) {
      setInvalid(true);
      return;
    }
    const ok = !draft.trim() || validateFieldValue(field.valueType, draft);
    setInvalid(!ok);
    if (!ok) return;
    const next = await fieldsRepo.edit(field.id, draft);
    if (next) {
      await auditRepo.add({
        documentId: field.documentId,
        kind: "edit",
        label: `${field.key} corrected`,
        oldValue: field.value,
        newValue: draft,
      });
      onChange(next);
    }
    setEditing(false);
  };

  return (
    <div
      className={`field-row ${active ? "is-active" : ""}`}
      onMouseEnter={onSelect}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !editing) {
          e.preventDefault();
          setEditing(true);
        }
        if (e.key === "Escape" && editing) {
          setDraft(field.value);
          setEditing(false);
          setInvalid(false);
        }
      }}
    >
      <div className="field-row-head">
        <span className="field-key">
          {field.key}
          {field.required ? " *" : ""}
        </span>
        {editing ? (
          <input
            className={`field-value ${invalid ? "is-invalid" : ""}`}
            value={draft}
            autoFocus
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(!validateFieldValue(field.valueType, e.target.value));
            }}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commit();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="field-value ghost-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (field.valueType === "table") {
                setTableOpen((v) => !v);
                return;
              }
              setEditing(true);
            }}
          >
            {field.value || (field.missing ? "missing" : "")}
          </button>
        )}
      </div>
      <div className={`tier tier-${field.tier}`}>
        <span className="tier-bar" aria-hidden />
        <span>{field.tier}</span>
        {field.schemaKey ? <span className="muted">{field.schemaKey}</span> : null}
        {field.missing ? <span>required field is empty</span> : null}
        {looksLikeO(field.value) ? <span>(looks like O may be 0)</span> : null}
      </div>
      {field.note ? <p className="muted field-note">{field.note}</p> : null}
      {tableOpen && field.valueType === "table" && cells ? (
        <div
          className="table-grid"
          style={{ gridTemplateColumns: `repeat(${cells[0]?.length ?? 1}, 1fr)` }}
        >
          {cells.flatMap((row, ri) =>
            row.map((cell, ci) => <span key={`${ri}-${ci}`}>{cell}</span>),
          )}
        </div>
      ) : null}
    </div>
  );
}

function looksLikeO(value: string): boolean {
  return /O\d|\dO/.test(value);
}
