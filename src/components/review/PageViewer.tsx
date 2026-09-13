"use client";

import { useEffect, useRef, useState } from "react";
import type { BBox, Block, FieldRecord } from "@/lib/types";
import { resolveFieldBBox } from "@/lib/pipeline/extraction/locate";
import { renderPdfPage } from "@/lib/pipeline/pdfReader";
import { filesRepo } from "@/lib/storage/documentsRepo";

interface Props {
  documentId: string;
  mimeType?: string;
  fileRevision?: number;
  fields: FieldRecord[];
  blocks: Block[];
  mode: "fields" | "blocks";
  activeId: string | null;
  onSelect: (id: string) => void;
  drawEnabled?: boolean;
  onDrawBox?: (bbox: BBox) => void;
  page?: number;
  extraHighlights?: { id: string; bbox: BBox; label?: string }[];
}

export function PageViewer({
  documentId,
  mimeType,
  fileRevision = 0,
  fields,
  blocks,
  mode,
  activeId,
  onSelect,
  drawEnabled,
  onDrawBox,
  page = 1,
  extraHighlights = [],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1, scale: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<BBox | null>(null);
  const textPreview = (mimeType ?? "").includes("pdf")
    ? ""
    : blocks.map((block) => block.text).join("\n");

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      const stored = await filesRepo.get(documentId);
      if (!stored || ac.signal.aborted) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const kind = mimeType ?? stored.mimeType;
      if (kind.includes("pdf")) {
        try {
          const metrics = await renderPdfPage(stored.blob, page, canvas, 1.4, ac.signal);
          if (metrics && !ac.signal.aborted) setSize(metrics);
        } catch (err) {
          if (!ac.signal.aborted) console.error("PDF preview failed", err);
        }
      } else if (kind.startsWith("image")) {
        const bmp = await createImageBitmap(stored.blob);
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(bmp, 0, 0);
        if (!ac.signal.aborted) {
          setSize({ width: bmp.width, height: bmp.height, scale: 1 });
        }
      } else {
        canvas.width = 720;
        canvas.height = 960;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim() || "#fffdf8";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim() || "#1a1815";
          ctx.font = "14px IBM Plex Mono, monospace";
          const text = textPreview || stored.filename;
          wrapText(ctx, text, 32, 40, 650, 20);
        }
        if (!ac.signal.aborted) setSize({ width: 720, height: 960, scale: 1 });
      }
    })();
    return () => {
      ac.abort();
    };
  }, [documentId, mimeType, page, fileRevision, textPreview]);

  const nativeWidth = size.width / size.scale;
  const scaleX = size.width / Math.max(nativeWidth, 1);
  const scaleY = size.height / Math.max(size.height / size.scale, 1);

  const overlays =
    mode === "fields"
      ? [
          ...fields
            .filter((f) => f.id === activeId)
            .map((f) => ({
              id: f.id,
              bbox: resolveFieldBBox(f, blocks),
              label: undefined as string | undefined,
            })),
          ...extraHighlights,
        ].filter((f) => f.bbox.page === page)
      : blocks
          .filter((b) => b.bbox.page === page)
          .map((b) => ({ id: b.id, bbox: b.bbox, label: b.type }));

  useEffect(() => {
    const box = stageRef.current?.querySelector(".bbox.is-active");
    box?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [activeId, page, size]);

  return (
    <div className="page-viewer">
      <div
        className="page-stage"
        ref={stageRef}
        onMouseDown={(e) => {
          if (!drawEnabled) return;
          const rect = stageRef.current?.getBoundingClientRect();
          if (!rect) return;
          drag.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }}
        onMouseMove={(e) => {
          if (!drawEnabled || !drag.current) return;
          const rect = stageRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x2 = e.clientX - rect.left;
          const y2 = e.clientY - rect.top;
          const x = Math.min(drag.current.x, x2);
          const y = Math.min(drag.current.y, y2);
          setDraft({
            x: x / scaleX,
            y: y / scaleY,
            width: Math.abs(x2 - drag.current.x) / scaleX,
            height: Math.abs(y2 - drag.current.y) / scaleY,
            page,
          });
        }}
        onMouseUp={() => {
          if (draft && onDrawBox && draft.width > 8 && draft.height > 8) {
            onDrawBox(draft);
          }
          drag.current = null;
          setDraft(null);
        }}
      >
        <canvas ref={canvasRef} />
        {overlays.map((item) => {
          return (
            <div
              key={item.id}
              className={`bbox ${activeId === item.id ? "is-active" : ""}`}
              style={{
                left: item.bbox.x * scaleX,
                top: item.bbox.y * scaleY,
                width: item.bbox.width * scaleX,
                height: item.bbox.height * scaleY,
              }}
              onMouseEnter={() => onSelect(item.id)}
              onClick={() => onSelect(item.id)}
            >
              {item.label ? <span className="bbox-label">{item.label}</span> : null}
            </div>
          );
        })}
        {draft ? (
          <div
            className="bbox is-active"
            style={{
              left: draft.x * scaleX,
              top: draft.y * scaleY,
              width: draft.width * scaleX,
              height: draft.height * scaleY,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else line = test;
    }
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}
