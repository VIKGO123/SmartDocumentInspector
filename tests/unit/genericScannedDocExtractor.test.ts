import { describe, expect, it } from "vitest";
import {
  extractGenericFields,
  postalCodeRecognizer,
  categoricalValueRecognizer,
} from "@/lib/pipeline/extraction/genericScannedDocExtractor";

describe("genericScannedDocExtractor", () => {
  it("extracts key-value lines generically without category hardcoding", () => {
    const text = `Invoice No: 4471\nDOB - 27/08/1997\nBlood Group : O+\nPolicy Number    ABC12345`;
    const fields = extractGenericFields(text);
    const labels = fields.map((f) => f.label);
    expect(labels).toContain("Invoice No");
    expect(labels).toContain("DOB");
    expect(labels).toContain("Blood Group");
    expect(labels).toContain("Policy Number");
  });

  it("extracts emails, phones, URLs, and dates", () => {
    const text = `Contact user@example.com or visit https://acme.org or call 9876543210 on 15/01/2026`;
    const fields = extractGenericFields(text);
    expect(fields.some((f) => f.value === "user@example.com")).toBe(true);
    expect(fields.some((f) => f.value === "https://acme.org")).toBe(true);
    expect(fields.some((f) => f.value === "9876543210")).toBe(true);
    expect(fields.some((f) => f.value === "15/01/2026")).toBe(true);
  });

  it("extracts grouped digit ID numbers", () => {
    const text = `Aadhaar ID: 1234 5678 9012`;
    const fields = extractGenericFields(text);
    expect(fields.some((f) => f.value === "1234 5678 9012")).toBe(true);
  });

  it("extracts categorical values and postal codes", () => {
    const text = `Gender: Female Pin Code: 560001`;
    const cat = categoricalValueRecognizer().recognize(text);
    const post = postalCodeRecognizer().recognize(text);
    expect(cat.some((f) => f.value.toLowerCase() === "female")).toBe(true);
    expect(post.some((f) => f.value === "560001")).toBe(true);
  });
});
