import { describe, expect, it } from "vitest";
import {
  lintFields,
  withoutSevereLintIssues,
  GENERIC_LABEL_DENYLIST,
  NUMBERED_SUFFIX,
} from "@/lib/pipeline/extraction/fieldQualityLint";
import type { ExtractedField } from "@/lib/pipeline/extraction/genericScannedDocExtractor";

describe("fieldQualityLint Unit Tests", () => {
  it("denylist correctly identifies generic section labels", () => {
    expect(GENERIC_LABEL_DENYLIST.test("Frontend")).toBe(true);
    expect(GENERIC_LABEL_DENYLIST.test("frontend (2)")).toBe(true);
    expect(GENERIC_LABEL_DENYLIST.test("Location")).toBe(true);
    expect(GENERIC_LABEL_DENYLIST.test("item (5)")).toBe(true);
    expect(GENERIC_LABEL_DENYLIST.test("Field")).toBe(true);
    expect(GENERIC_LABEL_DENYLIST.test("data")).toBe(true);

    // Concept-specific labels should not match denylist
    expect(GENERIC_LABEL_DENYLIST.test("Job Title")).toBe(false);
    expect(GENERIC_LABEL_DENYLIST.test("Email")).toBe(false);
    expect(GENERIC_LABEL_DENYLIST.test("Total Amount")).toBe(false);
  });

  it("numbered suffix regex catches sequential collision suffixes", () => {
    expect(NUMBERED_SUFFIX.test("Email (2)")).toBe(true);
    expect(NUMBERED_SUFFIX.test("Frontend (6)")).toBe(true);
    expect(NUMBERED_SUFFIX.test("Phone")).toBe(false);
  });

  it("flags generic labels and applies confidence penalties without dropping fields", () => {
    const rawFields: ExtractedField[] = [
      { label: "Job Title", value: "Lead Frontend Engineer", confidence: 0.9 },
      { label: "Frontend", value: "Fintech & AI Systems", confidence: 0.9 },
      { label: "Frontend (2)", value: "6+", confidence: 0.85 },
      { label: "Date", value: "WORK EXPERIENCE", confidence: 0.8 },
      { label: "Job Title", value: "Staff Engineer", confidence: 0.9 },
    ];

    const linted = lintFields(rawFields);

    expect(linted).toHaveLength(5);

    // First Job Title: clean
    expect(linted[0].lintFlags).toHaveLength(0);
    expect(linted[0].confidence).toBe(0.9);

    // "Frontend": generic-label flag, penalized to <= 0.4
    expect(linted[1].lintFlags).toContain("generic-label");
    expect(linted[1].confidence).toBeLessThanOrEqual(0.4);

    // "Frontend (2)": generic-label and numbered-suffix-label
    expect(linted[2].lintFlags).toContain("generic-label");
    expect(linted[2].lintFlags).toContain("numbered-suffix-label");
    expect(linted[2].confidence).toBeLessThanOrEqual(0.4);

    // "WORK EXPERIENCE": value-looks-like-heading
    expect(linted[3].lintFlags).toContain("value-looks-like-heading");
    expect(linted[3].confidence).toBeLessThanOrEqual(0.4);

    // Second "Job Title": duplicate-label-in-batch
    expect(linted[4].lintFlags).toContain("duplicate-label-in-batch");
    expect(linted[4].confidence).toBeLessThanOrEqual(0.4);
  });

  it("withoutSevereLintIssues filters out generic labels for quick views", () => {
    const rawFields: ExtractedField[] = [
      { label: "Name", value: "Jane Doe", confidence: 0.95 },
      { label: "Frontend (2)", value: "6+ years", confidence: 0.85 },
      { label: "Email", value: "jane@example.com", confidence: 0.99 },
    ];

    const linted = lintFields(rawFields);
    const filtered = withoutSevereLintIssues(linted);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((f) => f.label)).toEqual(["Name", "Email"]);
  });
});
