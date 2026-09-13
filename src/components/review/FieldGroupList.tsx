"use client";

import { useEffect, useMemo, useState } from "react";
import type { FieldRecord } from "@/lib/types";
import { FIELD_KIND_GROUPS } from "@/lib/types";
import { FieldRow } from "./FieldRow";

interface Props {
  fields: FieldRecord[];
  cellsByBlock: Record<string, string[][]>;
  activeId: string | null;
  onActive: (id: string) => void;
  onChange: (field: FieldRecord) => void;
  schemaLabel?: string;
}

export function FieldGroupList({
  fields,
  cellsByBlock,
  activeId,
  onActive,
  onChange,
  schemaLabel,
}: Props) {
  const modeled = fields.filter((f) => f.schemaKey);
  const extras = fields.filter((f) => !f.schemaKey);
  const attention = fields.filter(
    (f) => f.tier !== "high" || f.missing || (f.required && !f.value.trim()),
  );
  const rest = fields.filter((f) => !attention.includes(f));
  const [showRest, setShowRest] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const list = showRest ? [...attention, ...rest] : attention;
      if (!list.length) return;
      const idx = list.findIndex((f) => f.id === activeId);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = list[Math.min(list.length - 1, Math.max(0, idx) + 1)];
        if (next) onActive(next.id);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = list[Math.max(0, idx <= 0 ? 0 : idx - 1)];
        if (next) onActive(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, attention, rest, onActive, showRest]);

  const modeledAttention = useMemo(
    () => attention.filter((f) => f.schemaKey),
    [attention],
  );

  return (
    <div className="field-list">
      {schemaLabel ? (
        <p className="muted">
          Classified as <strong>{schemaLabel}</strong> — fields are semantic
          (type, required, confidence), not page coordinates.
        </p>
      ) : null}
      <h2 className="group-title">Needs your attention</h2>
      {attention.length === 0 ? (
        <p className="muted">Nothing flagged — scan Everything else if you want a second look.</p>
      ) : modeled.length ? (
        <>
          {renderList(modeledAttention, cellsByBlock, activeId, onActive, onChange)}
          {renderGrouped(
            attention.filter((f) => !f.schemaKey),
            cellsByBlock,
            activeId,
            onActive,
            onChange,
          )}
        </>
      ) : (
        renderGrouped(attention, cellsByBlock, activeId, onActive, onChange)
      )}
      <button
        type="button"
        className="ghost-btn"
        style={{ marginTop: "var(--space-4)" }}
        onClick={() => setShowRest((v) => !v)}
      >
        Everything else ({rest.length})
      </button>
      {showRest ? (
        modeled.length ? (
          <>
            {renderList(
              rest.filter((f) => f.schemaKey),
              cellsByBlock,
              activeId,
              onActive,
              onChange,
            )}
            {renderGrouped(
              extras.filter((f) => rest.includes(f)),
              cellsByBlock,
              activeId,
              onActive,
              onChange,
            )}
          </>
        ) : (
          renderGrouped(rest, cellsByBlock, activeId, onActive, onChange)
        )
      ) : null}
    </div>
  );
}

function renderList(
  fields: FieldRecord[],
  cellsByBlock: Record<string, string[][]>,
  activeId: string | null,
  onActive: (id: string) => void,
  onChange: (field: FieldRecord) => void,
) {
  if (!fields.length) return null;
  return (
    <section>
      <div className="kind-label">Model fields</div>
      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          active={activeId === field.id}
          onSelect={() => onActive(field.id)}
          onChange={onChange}
          cells={cellsByBlock[field.sourceBlockId]}
        />
      ))}
    </section>
  );
}

function renderGrouped(
  fields: FieldRecord[],
  cellsByBlock: Record<string, string[][]>,
  activeId: string | null,
  onActive: (id: string) => void,
  onChange: (field: FieldRecord) => void,
) {
  return FIELD_KIND_GROUPS.map((group) => {
    const subset = fields.filter((f) => group.types.includes(f.valueType));
    if (!subset.length) return null;
    return (
      <section key={group.label}>
        <div className="kind-label">{group.label}</div>
        {subset.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            active={activeId === field.id}
            onSelect={() => onActive(field.id)}
            onChange={onChange}
            cells={cellsByBlock[field.sourceBlockId]}
          />
        ))}
      </section>
    );
  });
}
