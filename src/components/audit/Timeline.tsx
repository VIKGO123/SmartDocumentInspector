"use client";

import type { AuditEvent } from "@/lib/types";

export function Timeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id}>
          <span className="dot" aria-hidden />
          <span>
            {event.label}
            {event.oldValue && event.newValue ? (
              <>
                {" "}
                <span className="diff strikethrough">{event.oldValue}</span>
                {" → "}
                <span className="diff">{event.newValue}</span>
              </>
            ) : null}
          </span>
          <span className="timestamp muted">{formatTs(event.at)}</span>
        </li>
      ))}
    </ol>
  );
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
