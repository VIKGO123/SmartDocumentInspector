import { describe, expect, it } from "vitest";
import { extractResumeProfile } from "@/lib/pipeline/extraction/resumeProfile";

const TEXT = `VIKASH PATHAK
Lead Frontend Engineer | Fintech & AI Systems | React, Next.js, Angular, TypeScript
https://www.linkedin.com/in/vikgo-27/
PROFESSIONAL SUMMARY
Lead Frontend Engineer with 6+ years of experience designing and building high-performance apps.
KEY HIGHLIGHTS
•
6+ years of frontend engineering experience across fintech and enterprise platforms
•
Architected and drove frontend technical strategy for an enterprise-grade insurance platform built with React
Gurugram, India | vikashpathak2797@gmail.com | +91 9872194452 |`;

describe("resume profile", () => {
  it("pulls Papersnap-style fields and joins split PDF bullets into notes", () => {
    const { fields, notes } = extractResumeProfile("d1", [], TEXT);
    const byKey = Object.fromEntries(fields.map((f) => [f.schemaKey, f.value]));
    expect(byKey.name).toBe("VIKASH PATHAK");
    expect(byKey.title).toBe("Lead Frontend Engineer");
    expect(byKey.specialization).toContain("Fintech");
    expect(byKey.linkedin).toContain("linkedin.com/in/vikgo-27");
    expect(byKey.email).toBe("vikashpathak2797@gmail.com");
    expect(byKey.phone).toContain("9872194452");
    expect(byKey.years_of_experience).toBe("6+");
    expect(byKey.location).toBe("Gurugram, India");
    expect(notes[0]).toContain("6+ years of experience");
    expect(notes.some((n) => n.includes("Architected and drove"))).toBe(true);
    expect(notes.some((n) => /artificial intelligence/i.test(n))).toBe(false);
  });

  it("rejoins wrapped PDF bullet lines", () => {
    const text = `PROFESSIONAL EXPERIENCE
• Architected and drove frontend technical strategy for an enterprise-grade insurance platform built with React and
Next.js, reducing UI load times by approximately 30% through performance profiling
CERTIFICATIONS
• Artificial Intelligence & Prompt Engineering`;
    const { notes } = extractResumeProfile("d1", [], text);
    expect(notes.some((n) => n.includes("reducing UI load times"))).toBe(true);
    expect(notes.some((n) => /artificial intelligence/i.test(n))).toBe(false);
  });
});
