import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BBox } from "@/lib/types";

export async function replaceInPdf(
  file: Blob,
  replacement: string,
  bbox?: BBox,
): Promise<Blob> {
  if (!bbox || bbox.width < 1 || bbox.height < 1) return file;
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pageIndex = Math.max(0, (bbox.page || 1) - 1);
  if (pageIndex >= pdf.getPageCount()) return file;
  const page = pdf.getPage(pageIndex);
  const { height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const text = toWinAnsi(replacement);
  const boxH = Math.max(bbox.height, 10);
  let size = Math.min(Math.max(boxH * 0.72, 8), 16);
  let textW = font.widthOfTextAtSize(text, size);
  const minW = Math.max(bbox.width, 24);
  while (textW > minW + 80 && size > 7) {
    size -= 0.5;
    textW = font.widthOfTextAtSize(text, size);
  }
  const coverW = Math.max(minW, textW + 6);
  const y = height - bbox.y - boxH;
  page.drawRectangle({
    x: Math.max(0, bbox.x - 1),
    y: Math.max(0, y - 1),
    width: coverW + 2,
    height: boxH + 2,
    color: rgb(1, 1, 1),
  });
  page.drawText(text, {
    x: bbox.x,
    y: y + Math.max(1, (boxH - size) / 2),
    size,
    font,
    color: rgb(0.11, 0.14, 0.13),
  });
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

function toWinAnsi(value: string): string {
  return value.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "?");
}
