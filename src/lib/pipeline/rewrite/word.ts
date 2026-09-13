import JSZip from "jszip";
import { extractDocBinaryText, replaceWordXmlText } from "./textReplace";

const WORD_PARTS = [
  "word/document.xml",
  "word/header1.xml",
  "word/header2.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footnotes.xml",
  "word/endnotes.xml",
];

export async function extractDocxText(file: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocText(file: Blob): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  return extractDocBinaryText(data);
}

export async function replaceInDocx(file: Blob, search: string, replacement: string): Promise<Blob> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  for (const path of WORD_PARTS) {
    const part = zip.file(path);
    if (!part) continue;
    const xml = await part.async("string");
    zip.file(path, replaceWordXmlText(xml, search, replacement));
  }
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
