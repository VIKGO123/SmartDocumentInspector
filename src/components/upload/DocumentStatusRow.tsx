"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IN_PROGRESS_STATUSES,
  STATUS_LABELS,
  type DocumentRecord,
} from "@/lib/types";

export function DocumentStatusRow({ doc }: { doc: DocumentRecord }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const inProgress = IN_PROGRESS_STATUSES.includes(doc.status);
  const clickable =
    doc.status === "needs-review" ||
    doc.status === "done" ||
    doc.status === "needs-manual-entry";

  const iconClass = inProgress
    ? "status-dot pulse"
    : doc.status === "failed"
      ? "status-dot fail"
      : doc.status === "needs-review" || doc.status === "needs-manual-entry"
        ? "status-dot review"
        : "status-dot check";

  const label = doc.statusDetail ?? STATUS_LABELS[doc.status];
  const prefix =
    doc.status === "failed"
      ? "✕"
      : doc.status === "done" ||
          doc.status === "needs-review" ||
          doc.status === "needs-manual-entry"
        ? "✓"
        : "●";

  return (
    <li>
      <button
        type="button"
        className="doc-row"
        aria-label={`${doc.filename}, ${label}`}
        onClick={() => {
          if (clickable || inProgress) router.push(`/document/${doc.id}`);
          else if (doc.status === "failed") setExpanded((v) => !v);
        }}
      >
        <span className={iconClass} aria-hidden />
        <span className="filename">{doc.filename}</span>
        <span className="muted">
          {prefix} {doc.status === "failed" ? `Failed: ${doc.failureReason ?? "unknown"}` : label}
        </span>
        {clickable ? <span aria-hidden>→</span> : null}
      </button>
      {expanded && doc.failureReason ? (
        <p className="failure-reason">{doc.failureReason}</p>
      ) : null}
    </li>
  );
}
