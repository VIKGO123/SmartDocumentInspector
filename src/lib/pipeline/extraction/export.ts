import JSZip from "jszip";
import type { PapersnapJson } from "./json";

/**
 * Escapes a cell value for CSV in compliance with RFC 4180.
 * If value contains comma, double-quote, or newline, wraps in quotes and escapes internal quotes.
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a clean, RFC 4180 compliant CSV representation of the extracted document.
 * Prefixes UTF-8 BOM (\uFEFF) so Excel and Google Sheets open non-ASCII characters without encoding glitches.
 */
export function toPapersnapCsv(payload: PapersnapJson): string {
  const rows: string[][] = [];

  // Header Row
  rows.push(["Category", "Field Key", "Label", "Value", "Confidence (%)"]);

  // Metadata Section
  rows.push(["Metadata", "document_id", "Document ID", payload.documentId, "-"]);
  rows.push(["Metadata", "document_type", "Document Type", payload.docType, "-"]);
  rows.push(["Metadata", "confidence", "Overall Confidence", `${payload.confidence}%`, String(payload.confidence)]);
  rows.push(["Metadata", "page_count", "Page Count", String(payload.pageCount), "-"]);

  // Extracted Fields Section
  for (const field of payload.fields ?? []) {
    rows.push([
      "Field",
      field.key,
      field.label,
      field.value,
      `${field.confidence}%`,
    ]);
  }

  // Document Notes Section
  if (payload.notes && payload.notes.length > 0) {
    payload.notes.forEach((note, idx) => {
      rows.push([
        "Document Note",
        `note_${idx + 1}`,
        `Note ${idx + 1}`,
        note,
        "-",
      ]);
    });
  }

  // Extracted Tables Section (if any)
  if (payload.tables && payload.tables.length > 0) {
    payload.tables.forEach((table, tIdx) => {
      table.cells.forEach((row, rIdx) => {
        rows.push([
          `Table ${tIdx + 1}`,
          `row_${rIdx + 1}`,
          `Row ${rIdx + 1}`,
          row.join(" | "),
          "-",
        ]);
      });
    });
  }

  // Build CSV with BOM
  const csvContent = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  return "\uFEFF" + csvContent;
}

/**
 * Triggers native browser download of the document in CSV format.
 */
export function downloadCsv(payload: PapersnapJson, filename: string) {
  const csv = toPapersnapCsv(payload);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerBrowserDownload(blob, cleanFilename(filename, ".csv"));
}

/**
 * Escapes characters for XML string literals.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Converts a 1-based column index to an Excel column letter (1 -> A, 2 -> B, 27 -> AA, etc.).
 */
function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Builds an OpenXML worksheet XML string from 2D data rows.
 * Uses inlineStr (<is><t>...</t></is>) for direct, dependency-free text cells.
 * Style index 1 is bold header with dark slate fill; style 0 is normal.
 */
function buildWorksheetXml(rows: string[][], colWidths: number[] = []): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  xml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;

  if (colWidths.length > 0) {
    xml += `  <cols>\n`;
    colWidths.forEach((w, idx) => {
      xml += `    <col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>\n`;
    });
    xml += `  </cols>\n`;
  }

  xml += `  <sheetData>\n`;
  rows.forEach((row, rowIdx) => {
    const r = rowIdx + 1;
    const isHeader = rowIdx === 0;
    const styleId = isHeader ? ` s="1"` : ``;
    xml += `    <row r="${r}">\n`;
    row.forEach((cellVal, colIdx) => {
      const colLetter = getColumnLetter(colIdx + 1);
      const cellRef = `${colLetter}${r}`;
      const escaped = escapeXml(cellVal ?? "");
      xml += `      <c r="${cellRef}" t="inlineStr"${styleId}><is><t>${escaped}</t></is></c>\n`;
    });
    xml += `    </row>\n`;
  });
  xml += `  </sheetData>\n`;
  xml += `</worksheet>`;
  return xml;
}

/**
 * Generates an OpenXML (.xlsx) Blob using JSZip.
 * Produces a multi-sheet spreadsheet:
 * - Sheet 1: "Extracted Fields" (Field Key, Label, Value, Confidence)
 * - Sheet 2: "Document Metadata & Notes" (Section, Property, Value)
 */
export async function toPapersnapExcelBlob(payload: PapersnapJson): Promise<Blob> {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  // 3. xl/_rels/workbook.xml.rels
  zip.folder("xl")?.folder("_rels")?.file(
    "workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  // 4. xl/workbook.xml
  zip.folder("xl")?.file(
    "workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Extracted Fields" sheetId="1" r:id="rId1"/>
    <sheet name="Metadata &amp; Notes" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`
  );

  // 5. xl/styles.xml
  zip.folder("xl")?.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`
  );

  // 6. Sheet 1: Extracted Fields
  const fieldRows: string[][] = [
    ["Field Key", "Label", "Value", "Confidence (%)"],
  ];
  for (const f of payload.fields ?? []) {
    fieldRows.push([f.key, f.label, f.value, `${f.confidence}%`]);
  }
  const sheet1Xml = buildWorksheetXml(fieldRows, [20, 24, 45, 18]);
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", sheet1Xml);

  // 7. Sheet 2: Metadata & Notes
  const metaRows: string[][] = [
    ["Section", "Property", "Details"],
    ["Metadata", "Document ID", payload.documentId],
    ["Metadata", "Document Type", payload.docType],
    ["Metadata", "Confidence Score", `${payload.confidence}%`],
    ["Metadata", "Page Count", String(payload.pageCount)],
    ["Metadata", "Legibility", `${payload.quality?.pageLegibility ?? 0}%`],
    ["Metadata", "Text Source", payload.quality?.textSource ?? "digital"],
  ];

  if (payload.notes && payload.notes.length > 0) {
    payload.notes.forEach((note, idx) => {
      metaRows.push(["Document Note", `Note #${idx + 1}`, note]);
    });
  }

  if (payload.tables && payload.tables.length > 0) {
    payload.tables.forEach((table, tIdx) => {
      table.cells.forEach((row, rIdx) => {
        metaRows.push([`Table #${tIdx + 1}`, `Row #${rIdx + 1}`, row.join(" | ")]);
      });
    });
  }

  const sheet2Xml = buildWorksheetXml(metaRows, [20, 24, 65]);
  zip.folder("xl")?.folder("worksheets")?.file("sheet2.xml", sheet2Xml);

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Triggers native browser download of the document in Excel (.xlsx) format.
 */
export async function downloadExcel(payload: PapersnapJson, filename: string) {
  const blob = await toPapersnapExcelBlob(payload);
  triggerBrowserDownload(blob, cleanFilename(filename, ".xlsx"));
}

function cleanFilename(filename: string, ext: string): string {
  return filename.replace(/\.[^.]+$/, "") + ext;
}

function triggerBrowserDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
