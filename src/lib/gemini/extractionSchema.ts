import { Type, type Schema } from "@google/genai";

// ---------- TypeScript types ----------

export interface ExtractedField {
  label: string;
  value: string;
  valueType?: "text" | "date" | "currency" | "email" | "phone" | "number" | "url";
  confidence?: number;
}

export interface ExtractedEntry {
  fields: ExtractedField[];
  bullets?: string[];
}

export interface ExtractedSection {
  sectionTitle: string;
  entries: ExtractedEntry[];
}

export interface ExtractionResult {
  documentType: string;
  sections: ExtractedSection[];
  summary?: string;
}

// ---------- Gemini responseSchema ----------

export const extractionResponseSchema: Schema = {
  type: Type?.OBJECT ?? ("OBJECT" as unknown as typeof Type.OBJECT),
  properties: {
    documentType: {
      type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
      description:
        "Your own free-text guess at what kind of document this is (e.g. 'resume', 'invoice', 'lease agreement'). Do not pick from a fixed list.",
    },
    summary: {
      type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
      description:
        "Optional 1-3 sentence summary of the document, if one is naturally present or easily inferred.",
    },
    sections: {
      type: Type?.ARRAY ?? ("ARRAY" as unknown as typeof Type.ARRAY),
      items: {
        type: Type?.OBJECT ?? ("OBJECT" as unknown as typeof Type.OBJECT),
        properties: {
          sectionTitle: {
            type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
            description:
              "The section's own heading as it appears (or a short label you assign if the document has no explicit headings), e.g. 'Professional Experience', 'Line Items', 'Header'.",
          },
          entries: {
            type: Type?.ARRAY ?? ("ARRAY" as unknown as typeof Type.ARRAY),
            items: {
              type: Type?.OBJECT ?? ("OBJECT" as unknown as typeof Type.OBJECT),
              properties: {
                fields: {
                  type: Type?.ARRAY ?? ("ARRAY" as unknown as typeof Type.ARRAY),
                  items: {
                    type: Type?.OBJECT ?? ("OBJECT" as unknown as typeof Type.OBJECT),
                    properties: {
                      label: {
                        type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
                      },
                      value: {
                        type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
                      },
                      valueType: {
                        type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
                        enum: [
                          "text",
                          "date",
                          "currency",
                          "email",
                          "phone",
                          "number",
                          "url",
                        ],
                      },
                      confidence: {
                        type: Type?.NUMBER ?? ("NUMBER" as unknown as typeof Type.NUMBER),
                        description:
                          "Your own confidence in this specific value, 0.0 to 1.0.",
                      },
                    },
                    required: ["label", "value"],
                    propertyOrdering: ["label", "value", "valueType", "confidence"],
                  },
                },
                bullets: {
                  type: Type?.ARRAY ?? ("ARRAY" as unknown as typeof Type.ARRAY),
                  items: {
                    type: Type?.STRING ?? ("STRING" as unknown as typeof Type.STRING),
                  },
                  description:
                    "Free-text bullet points belonging to this entry, if any (e.g. a job's achievement bullets).",
                },
              },
              required: ["fields"],
              propertyOrdering: ["fields", "bullets"],
            },
          },
        },
        required: ["sectionTitle", "entries"],
        propertyOrdering: ["sectionTitle", "entries"],
      },
    },
  },
  required: ["documentType", "sections"],
  propertyOrdering: ["documentType", "summary", "sections"],
};
