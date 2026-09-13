"use client";

import { useRef } from "react";

interface Props {
  note: string;
  active: boolean;
  index: number;
  onHover: () => void;
  onSave: (value: string) => void;
  searchHit?: boolean;
  searchCurrent?: boolean;
}

export function DocumentNote({
  note,
  active,
  index,
  onHover,
  onSave,
  searchHit = false,
  searchCurrent = false,
}: Props) {
  const timer = useRef<number>(0);

  return (
    <li
      id={`match-note-${index}`}
      className={`note-item ${active ? "is-active" : ""} ${searchHit ? "is-search-hit" : ""} ${searchCurrent ? "is-search-current" : ""}`}
    >
      <textarea
        className="note-editor"
        aria-label={`Edit document note ${index + 1}`}
        defaultValue={note}
        key={index}
        rows={Math.min(8, Math.max(3, Math.ceil(note.length / 88)))}
        onMouseEnter={onHover}
        onFocus={onHover}
        onChange={(e) => {
          const value = e.target.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onSave(value), 400);
        }}
        onBlur={(e) => {
          window.clearTimeout(timer.current);
          onSave(e.target.value);
        }}
      />
    </li>
  );
}
