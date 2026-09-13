import type { PositionedItem } from "@/lib/types";

export interface PdfPageRead {
  page: number;
  width: number;
  height: number;
  items: PositionedItem[];
  needsOcr: boolean;
}

let workerReady = false;

async function pdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerReady && typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
    workerReady = true;
  }
  return pdfjsLib;
}

export async function readPdf(file: File): Promise<PdfPageRead[]> {
  const pdfjsLib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: PdfPageRead[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PositionedItem[] = [];

    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      const item = raw as {
        str: string;
        transform: number[];
        width: number;
        height: number;
      };
      const [, , , d, e, f] = item.transform;
      const fontSize = Math.abs(d) || item.height || 10;
      const [vx1, vy1] = viewport.convertToViewportPoint(e, f);
      const [vx2, vy2] = viewport.convertToViewportPoint(
        e + (item.width || 0),
        f + fontSize,
      );
      const x = Math.min(vx1, vx2);
      const y = Math.min(vy1, vy2);
      items.push({
        text: item.str,
        fontSize,
        confidence: 1,
        bbox: {
          x,
          y,
          width: Math.abs(vx2 - vx1) || item.width || fontSize,
          height: Math.abs(vy2 - vy1) || fontSize,
          page: pageNum,
        },
      });
    }

    pages.push({
      page: pageNum,
      width: viewport.width,
      height: viewport.height,
      items,
      needsOcr: items.length < 4,
    });
  }

  return pages;
}

export async function renderPdfPage(
  file: Blob,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 1.4,
  signal?: AbortSignal,
): Promise<{ width: number; height: number; scale: number } | null> {
  if (signal?.aborted) return null;
  const pdfjsLib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const abortLoad = () => {
    void loadingTask.destroy();
  };
  signal?.addEventListener("abort", abortLoad, { once: true });
  try {
    const doc = await loadingTask.promise;
    if (signal?.aborted) {
      await loadingTask.destroy();
      return null;
    }
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    const task = page.render({ canvasContext: ctx, viewport, canvas });
    const abortRender = () => task.cancel();
    signal?.addEventListener("abort", abortRender, { once: true });
    try {
      await task.promise;
    } catch (err) {
      if (isRenderCancelled(err) || signal?.aborted) return null;
      throw err;
    } finally {
      signal?.removeEventListener("abort", abortRender);
      await loadingTask.destroy();
    }
    if (signal?.aborted) return null;
    return { width: viewport.width, height: viewport.height, scale };
  } catch (err) {
    if (isRenderCancelled(err) || signal?.aborted) return null;
    throw err;
  } finally {
    signal?.removeEventListener("abort", abortLoad);
  }
}

function isRenderCancelled(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  const message = "message" in err ? String(err.message) : "";
  return (
    name === "RenderingCancelledException" ||
    name === "AbortException" ||
    /cancel/i.test(message)
  );
}

export async function renderPdfPageToImage(
  file: Blob,
  pageNumber: number,
  scale = 2,
): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  const result = await renderPdfPage(file, pageNumber, canvas, scale);
  if (!result) throw new Error("PDF render was cancelled.");
  return createImageBitmap(canvas);
}
