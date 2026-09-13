import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { escapeCsvValue, toPapersnapCsv, toPapersnapExcelBlob } from "@/lib/pipeline/extraction/export";
import type { PapersnapJson } from "@/lib/pipeline/extraction/json";

const mockPayload: PapersnapJson = {
  documentId: "doc-12345",
  docType: "resume",
  confidence: 92,
  pageCount: 2,
  fields: [
    { key: "name", label: "Full Name", value: "Vikash Pathak", confidence: 95 },
    { key: "email", label: "Email Address", value: "vikash@example.com", confidence: 98 },
    { key: "location", label: "Location", value: "Gurugram, India", confidence: 90 },
    { key: "summary", label: "Summary", value: 'Lead Engineer with "AI" experience, Next.js', confidence: 85 },
  ],
  lineItems: [],
  tables: [
    { cells: [["Skill", "Years"], ["React", "6+"], ["TypeScript", "5+"]] },
  ],
  notes: [
    "Lead Frontend Engineer at BlackRock.",
    "B.Tech in Computer Engineering with 8.62 CGPA.",
  ],
  quality: {
    extractionConfidence: 92,
    pageLegibility: 100,
    textSource: "digital",
    handwritingPct: 0,
    checks: {},
    checksPassed: 4,
    checksTotal: 4,
    advice: [],
    userInput: { edited: 0, flagged: 0, rescans: 0 },
  },
};

describe("CSV Export", () => {
  it("escapes CSV values with commas, quotes, and newlines properly", () => {
    expect(escapeCsvValue("simple")).toBe("simple");
    expect(escapeCsvValue("Gurugram, India")).toBe('"Gurugram, India"');
    expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
    expect(escapeCsvValue("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(escapeCsvValue(null)).toBe("");
  });

  it("generates RFC 4180 compliant CSV with UTF-8 BOM", () => {
    const csv = toPapersnapCsv(mockPayload);

    // Assert UTF-8 BOM is present for Excel compatibility
    expect(csv.startsWith("\uFEFF")).toBe(true);

    // Assert header columns
    expect(csv).toContain("Category,Field Key,Label,Value,Confidence (%)");

    // Assert metadata rows
    expect(csv).toContain("Metadata,document_id,Document ID,doc-12345,-");
    expect(csv).toContain("Metadata,confidence,Overall Confidence,92%,92");

    // Assert field rows with comma and quote escaping
    expect(csv).toContain("Field,name,Full Name,Vikash Pathak,95%");
    expect(csv).toContain('Field,location,Location,"Gurugram, India",90%');
    expect(csv).toContain('Field,summary,Summary,"Lead Engineer with ""AI"" experience, Next.js",85%');

    // Assert document notes and tables
    expect(csv).toContain("Document Note,note_1,Note 1,Lead Frontend Engineer at BlackRock.,-");
    expect(csv).toContain("Table 1,row_1,Row 1,Skill | Years,-");
  });
});

describe("Excel (.xlsx) Export", () => {
  it("generates a valid OpenXML spreadsheet blob with multi-sheet workbook", async () => {
    const blob = await toPapersnapExcelBlob(mockPayload);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(1000);

    // Unpack with JSZip to verify OpenXML archive contents
    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Verify critical OpenXML structure
    expect(zip.file("[Content_Types].xml")).toBeDefined();
    expect(zip.file("xl/workbook.xml")).toBeDefined();
    expect(zip.file("xl/styles.xml")).toBeDefined();
    expect(zip.file("xl/worksheets/sheet1.xml")).toBeDefined();
    expect(zip.file("xl/worksheets/sheet2.xml")).toBeDefined();

    // Verify Sheet 1 (Extracted Fields) content
    const sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(sheet1Xml).toContain("Field Key");
    expect(sheet1Xml).toContain("Full Name");
    expect(sheet1Xml).toContain("Vikash Pathak");
    expect(sheet1Xml).toContain("95%");

    // Verify Sheet 2 (Metadata & Notes) content
    const sheet2Xml = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(sheet2Xml).toContain("Document ID");
    expect(sheet2Xml).toContain("doc-12345");
    expect(sheet2Xml).toContain("Lead Frontend Engineer at BlackRock.");
  });
});
