import { wordsFromTesseractPage, type OcrResult } from "./ocrWords";

export type { OcrResult, OcrWord } from "./ocrWords";

export async function ocrImage(
  image: ImageBitmap | Blob | HTMLCanvasElement,
  page = 1,
): Promise<OcrResult> {
  if (typeof window === "undefined") {
    return { text: "", words: [] };
  }
  try {
    return await ocrViaWorker(image, page);
  } catch {
    return ocrOnMain(image, page);
  }
}

async function ocrViaWorker(
  image: ImageBitmap | Blob | HTMLCanvasElement,
  page: number,
): Promise<OcrResult> {
  const worker = new Worker(new URL("../../workers/ocr.worker.ts", import.meta.url), {
    type: "module",
  });
  const bitmap =
    image instanceof ImageBitmap ? image : await toBitmap(image);
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("OCR worker timed out"));
    }, 120000);
    worker.onmessage = (event: MessageEvent<OcrResult | { error: string }>) => {
      window.clearTimeout(timer);
      worker.terminate();
      if ("error" in event.data) reject(new Error(event.data.error));
      else resolve(scaleResult(event.data, page));
    };
    worker.onerror = (err) => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ bitmap, page }, [bitmap]);
  });
}

async function ocrOnMain(
  image: ImageBitmap | Blob | HTMLCanvasElement,
  page: number,
): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const input = image instanceof Blob ? image : await bitmapToBlob(image);
  const { data } = await worker.recognize(input);
  await worker.terminate();
  return {
    text: data.text,
    words: wordsFromTesseractPage(data, page),
  };
}

function scaleResult(result: OcrResult, page: number): OcrResult {
  return {
    text: result.text,
    words: result.words.map((w) => ({
      ...w,
      bbox: { ...w.bbox, page },
    })),
  };
}

async function toBitmap(image: Blob | HTMLCanvasElement): Promise<ImageBitmap> {
  if (image instanceof Blob) return createImageBitmap(image);
  return createImageBitmap(image);
}

async function bitmapToBlob(image: ImageBitmap | HTMLCanvasElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  if (image instanceof HTMLCanvasElement) {
    return new Promise((resolve, reject) => {
      image.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
    });
  }
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no ctx");
  ctx.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
