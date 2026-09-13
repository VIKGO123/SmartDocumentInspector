/// <reference lib="webworker" />

import { createWorker } from "tesseract.js";
import { wordsFromTesseractPage } from "../lib/pipeline/ocrWords";

type InMessage = { bitmap: ImageBitmap; page: number };

self.onmessage = async (event: MessageEvent<InMessage>) => {
  try {
    const { bitmap, page } = event.data;
    const worker = await createWorker("eng");
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No OffscreenCanvas context");
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const { data } = await worker.recognize(blob);
    await worker.terminate();
    self.postMessage({
      text: data.text,
      words: wordsFromTesseractPage(data, page),
    });
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : "OCR failed",
    });
  }
};
