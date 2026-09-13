import type Tesseract from "tesseract.js";
import type { BBox } from "@/lib/types";

export interface OcrWord {
  text: string;
  bbox: BBox;
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

export function wordsFromTesseractPage(data: Tesseract.Page, page: number): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push({
            text: word.text,
            confidence: (word.confidence ?? 0) / 100,
            bbox: {
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0,
              page,
            },
          });
        }
      }
    }
  }
  return words;
}
