import { z } from "zod";

export const ExtractedCloudFieldSchema = z.object({
  key: z.string().describe("Human-readable label of the extracted field"),
  value: z.string().describe("Extracted text value or synthesized fact"),
  valueType: z
    .enum([
      "date",
      "money",
      "email",
      "phone",
      "url",
      "id",
      "person",
      "org",
      "location",
      "table",
      "text",
    ])
    .default("text")
    .describe("Semantic data type"),
  confidenceReasoning: z
    .string()
    .optional()
    .describe("Brief explanation of why this field was extracted or inferred"),
});

export const CloudExtractionResponseSchema = z.object({
  documentSummary: z
    .string()
    .optional()
    .describe("Short 1-2 sentence executive summary of the document"),
  detectedType: z
    .string()
    .optional()
    .describe("Detected document type (Invoice, Receipt, Resume, Contract, etc.)"),
  fields: z.array(ExtractedCloudFieldSchema),
});

export type ExtractedCloudField = z.infer<typeof ExtractedCloudFieldSchema>;
export type CloudExtractionResponse = z.infer<
  typeof CloudExtractionResponseSchema
>;
