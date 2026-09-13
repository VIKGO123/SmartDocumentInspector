import { describe, expect, it } from "vitest";
import { classifyDocument } from "@/lib/pipeline/classifyDocument";
import { bindToSchema } from "@/lib/pipeline/extraction/bindToSchema";
import { toPapersnapJson } from "@/lib/pipeline/extraction/json";
import { schemaById } from "@/lib/pipeline/schemas";
import type { Block, DocumentRecord, FieldRecord } from "@/lib/types";

const bbox = { x: 0, y: 0, width: 40, height: 12, page: 1 };

function candidate(
  partial: Partial<FieldRecord> & Pick<FieldRecord, "key" | "value" | "valueType">,
): Omit<FieldRecord, "confidence" | "tier"> {
  return {
    id: crypto.randomUUID(),
    documentId: "doc-1",
    bbox,
    sourceBlockId: "b1",
    edited: false,
    editHistory: [],
    ...partial,
  };
}

describe("classify then bind", () => {
  it("classifies an invoice from wording, not from coordinates", () => {
    const schema = classifyDocument(
      "scan.pdf",
      "Invoice\nBill to Jane\nTotal due $1,400.00",
      [],
    );
    expect(schema.id).toBe("invoice");
  });

  it("classifies an identity document from Aadhaar / Passport indicators", () => {
    const schema = classifyDocument(
      "aadhaar_card.pdf",
      "Government of India\nUnique Identification Authority of India\nAadhaar Card\nDOB: 12/05/1990",
      [],
    );
    expect(schema.id).toBe("identity");
  });

  it("classifies financial & tax documents from payslip and statement cues", () => {
    const schema = classifyDocument(
      "salary_slip.pdf",
      "Salary Slip for Month of August 2026\nGross Salary: 85000\nNet Pay: 76000\nEmployee ID: 4920",
      [],
    );
    expect(schema.id).toBe("tax_financial");
  });

  it("classifies medical and healthcare records", () => {
    const schema = classifyDocument(
      "health_report.pdf",
      "Apex Hospital Diagnostics\nPatient Name: John Doe\nPrescription & Diagnosis\nBlood pressure: 120/80",
      [],
    );
    expect(schema.id).toBe("medical");
  });

  it("classifies credentials and certificates", () => {
    const schema = classifyDocument(
      "degree_award.pdf",
      "Certificate of Completion\nThis is to certify that Jane Doe has successfully completed Advanced Machine Learning",
      [],
    );
    expect(schema.id).toBe("certificate");
  });

  it("maps Amount due to total_due instead of subtotal", () => {
    const schema = schemaById("invoice");
    const blocks: Block[] = [
      {
        id: "b1",
        type: "keyValue",
        text: "Amount due: $1,400.00",
        bbox,
      },
      {
        id: "b2",
        type: "keyValue",
        text: "Subtotal: $1,200.00",
        bbox: { ...bbox, y: 20 },
      },
    ];
    const bound = bindToSchema(
      schema,
      [
        candidate({
          key: "Amount due",
          value: "$1,400.00",
          valueType: "money",
          sourceBlockId: "b1",
        }),
        candidate({
          key: "Subtotal",
          value: "$1,200.00",
          valueType: "money",
          sourceBlockId: "b2",
        }),
      ],
      blocks,
    );
    const total = bound.find((f) => f.schemaKey === "total_due");
    const sub = bound.find((f) => f.schemaKey === "subtotal");
    expect(total?.value).toBe("$1,400.00");
    expect(total?.key).toBe("Amount due");
    expect(sub?.value).toBe("$1,200.00");
    expect(sub?.key).toBe("Subtotal");
  });

  it("emits Papersnap-shaped JSON for integrations", () => {
    const document: DocumentRecord = {
      id: "doc-1",
      filename: "invoice.txt",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      fileHash: "abc",
      status: "done",
      rawText: "",
      blockTree: [],
      layoutFingerprint: "",
      schemaId: "invoice",
      documentType: "Invoice",
      notes: [],
    };
    const json = toPapersnapJson(document, [
      {
        id: "f1",
        documentId: "doc-1",
        key: "Total due",
        schemaKey: "total_due",
        value: "$1,400.00",
        valueType: "money",
        confidence: 0.91,
        tier: "high",
        required: true,
        note: "final amount payable after tax",
        bbox,
        sourceBlockId: "b1",
        edited: false,
        editHistory: [],
      },
    ]);
    expect(json.documentId).toBe("doc-1");
    expect(json.docType).toBe("invoice");
    expect(json.fields[0]).toMatchObject({
      key: "total_due",
      label: "Total due",
      value: "$1,400.00",
      confidence: 91,
    });
    expect(json.lineItems).toEqual([]);
    expect(json.quality.extractionConfidence).toBe(91);
  });
});
