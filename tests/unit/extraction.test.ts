import { describe, expect, it } from "vitest";
import { extractPatterns, validateFieldValue } from "@/lib/pipeline/extraction/patterns";

describe("pattern extraction", () => {
  it("finds email, money, date, and phone", () => {
    const text =
      "Send to jane.doe@acme.com by 03/14/2026. Total due $1,400.00. Call 415-555-0199.";
    const hits = extractPatterns(text);
    const types = hits.map((h) => h.valueType);
    expect(types).toContain("email");
    expect(types).toContain("money");
    expect(types).toContain("date");
    expect(types).toContain("phone");
  });

  it("validates typed values with zod", () => {
    expect(validateFieldValue("email", "not-an-email")).toBe(false);
    expect(validateFieldValue("email", "jane@acme.com")).toBe(true);
    expect(validateFieldValue("money", "$1,400.00")).toBe(true);
  });
});
