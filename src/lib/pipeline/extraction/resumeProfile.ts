import type { Block, FieldRecord, FieldValueType } from "@/lib/types";
import { EMAIL_RE } from "./patterns";
import { locateInBlocks } from "./locate";

const SECTIONS =
  /^(professional summary|key highlights|technical skills|professional experience|education|certifications|languages|work experience|skills)$/i;

const PHONE_INTL =
  /\+\d{1,3}[\s.-]?\d{6,12}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/;

type Candidate = Omit<FieldRecord, "confidence" | "tier">;

export function extractResumeProfile(
  documentId: string,
  blocks: Block[],
  rawText: string,
): { fields: Candidate[]; notes: string[] } {
  const lines = flattenResumeLines(rawText);
  const fields: Candidate[] = [];
  const push = (
    schemaKey: string,
    label: string,
    value: string,
    valueType: FieldValueType,
  ) => {
    const v = value.trim();
    if (!v) return;
    const located = locateInBlocks(blocks, v.slice(0, 48));
    fields.push({
      id: crypto.randomUUID(),
      documentId,
      key: label,
      value: v,
      valueType,
      schemaKey,
      bbox: located?.bbox ?? blocks[0]?.bbox ?? { x: 0, y: 0, width: 0, height: 0, page: 1 },
      sourceBlockId: located?.id ?? blocks[0]?.id ?? "",
      edited: false,
      editHistory: [],
    });
  };

  const nameLine = lines.find(
    (l) =>
      !SECTIONS.test(l) &&
      !/@/.test(l) &&
      !/https?:/i.test(l) &&
      !l.startsWith("•") &&
      /^[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){1,3}$/.test(l) &&
      l.length < 48,
  );
  if (nameLine) push("name", "Name", nameLine, "person");

  const headline = lines.find(
    (l) =>
      /engineer|developer|designer|manager|architect|analyst/i.test(l) &&
      l.includes("|"),
  );
  if (headline) {
    const parts = headline.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts[0]) push("title", "Title", parts[0], "text");
    if (parts.length > 1) {
      push("specialization", "Specialization", parts.slice(1).join(" | "), "text");
    }
  } else {
    const titleLine = lines.find(
      (l) =>
        /engineer|developer|designer|manager|architect|analyst/i.test(l) &&
        l.length < 80 &&
        !SECTIONS.test(l) &&
        !l.startsWith("•"),
    );
    if (titleLine) push("title", "Title", titleLine.split("|")[0].trim(), "text");
  }

  const linkedin = rawText.match(/https?:\/\/[^\s]*linkedin\.com\/[^\s)|]+/i);
  if (linkedin) push("linkedin", "Linkedin", linkedin[0].replace(/[.,;]+$/, ""), "url");

  EMAIL_RE.lastIndex = 0;
  const email = rawText.match(EMAIL_RE);
  if (email) push("email", "Email", email[0], "email");

  const phone = rawText.match(PHONE_INTL);
  if (phone) push("phone", "Phone", phone[0].replace(/\s+/g, " ").trim(), "phone");

  const years =
    rawText.match(/(\d+\+?)\s+years of(?: frontend)? engineering experience/i) ??
    rawText.match(/with\s+(\d+\+?)\s+years of experience/i);
  if (years) push("years_of_experience", "Years Of Experience", years[1], "text");

  const location =
    rawText.match(
      /\b([A-Z][a-zA-Z]+(?:[ \t]+[A-Z][a-zA-Z]+)*),[ \t]*(India|USA|UK|United States|United Kingdom)\b/,
    ) ?? rawText.match(/\b([A-Z][a-z]+,[ \t]*[A-Z][a-z]+)\b/);
  if (location) push("location", "Location", location[0], "location");

  const notes: string[] = [];
  const summaryIdx = lines.findIndex((l) => /^professional summary$/i.test(l));
  if (summaryIdx >= 0) {
    const summary: string[] = [];
    for (let i = summaryIdx + 1; i < lines.length; i += 1) {
      if (SECTIONS.test(lines[i]) || lines[i].startsWith("•")) break;
      summary.push(lines[i]);
    }
    const blob = summary.join(" ").replace(/\s+/g, " ").trim();
    if (blob) notes.push(blob);
  }

  let skipNotes = false;
  for (const line of lines) {
    if (/^(education|certifications|languages|technical skills|skills)$/i.test(line)) {
      skipNotes = true;
      continue;
    }
    if (SECTIONS.test(line)) skipNotes = false;
    if (skipNotes || !line.startsWith("•")) continue;
    const t = line.replace(/^•\s*/, "").trim();
    if (t.length > 40) notes.push(t);
  }

  if (notes.length < 3) {
    for (const block of blocks) {
      if (block.type === "listItem") {
        const t = block.text.replace(/^[-*•]\s*/, "").trim();
        if (t.length > 40 && !notes.includes(t)) notes.push(t);
      }
    }
  }

  return { fields, notes: uniqueNotes(notes) };
}

function isBulletMarker(line: string): boolean {
  return line === "•" || line === "·";
}

function isBulletLine(line: string): boolean {
  return isBulletMarker(line) || /^[•·]\s+\S/.test(line);
}

function isNoteBreak(line: string): boolean {
  if (SECTIONS.test(line) || isBulletLine(line)) return true;
  if (
    /engineer|intern|analyst|associate|developer|manager/i.test(line) &&
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line)
  ) {
    return true;
  }
  if (/—/.test(line) && line.length < 90) return true;
  return false;
}

function flattenResumeLines(rawText: string): string[] {
  const rawLines = rawText
    .split(/\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trim())
    .filter((l) => l && !/^--\s*\d+\s+of\s+\d+\s*--$/.test(l));
  const out: string[] = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    if (!isBulletLine(rawLines[i])) {
      out.push(rawLines[i]);
      continue;
    }
    const chunk: string[] = [];
    if (!isBulletMarker(rawLines[i])) {
      chunk.push(rawLines[i].replace(/^[•·]\s*/, ""));
    }
    i += 1;
    while (i < rawLines.length && !isNoteBreak(rawLines[i])) {
      chunk.push(rawLines[i]);
      i += 1;
    }
    i -= 1;
    const joined = chunk.join(" ").replace(/\s+/g, " ").trim();
    if (joined) out.push(`• ${joined}`);
  }
  return out;
}

function uniqueNotes(notes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of notes) {
    const k = note.slice(0, 80).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(note);
  }
  return out.slice(0, 20);
}
