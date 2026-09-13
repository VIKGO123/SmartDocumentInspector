import type { FieldProvenance } from "@/lib/types";

export interface GroundingResult {
  provenance: FieldProvenance;
  groundingScore: number;
}

export function computeGrounding(
  value: string,
  rawText: string,
): GroundingResult {
  const normVal = value.trim().toLowerCase();
  const normText = rawText.toLowerCase();

  if (!normVal) {
    return { provenance: "cloud-inferred", groundingScore: 0 };
  }

  // Exact verbatim match in raw text
  if (normText.includes(normVal)) {
    return { provenance: "cloud-verbatim", groundingScore: 1.0 };
  }

  // Check sub-words match (e.g. numbers or key terms in string)
  const words = normVal.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) {
    return { provenance: "cloud-inferred", groundingScore: 0.2 };
  }

  let matchedWords = 0;
  for (const word of words) {
    if (normText.includes(word)) {
      matchedWords += 1;
    }
  }

  const matchRatio = matchedWords / words.length;
  if (matchRatio >= 0.8) {
    return { provenance: "cloud-verbatim", groundingScore: 0.85 };
  }

  return {
    provenance: "cloud-inferred",
    groundingScore: Math.round(matchRatio * 0.7 * 100) / 100,
  };
}
