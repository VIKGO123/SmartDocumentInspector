import { GoogleGenAI, Type } from "@google/genai";
import {
  CloudExtractionResponseSchema,
  type CloudExtractionResponse,
} from "./schema";
import { buildCloudExtractPrompt } from "./promptTemplate";

export async function callGeminiExtract(
  filename: string,
  rawText: string,
  existingFieldKeys?: string[],
): Promise<CloudExtractionResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      "GEMINI_API_KEY is not configured in .env.local — Please add your Gemini API key from https://aistudio.google.com/app/apikey to .env.local",
    );
  }

  const prompt = buildCloudExtractPrompt(filename, rawText, existingFieldKeys);
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentSummary: { type: Type.STRING },
          detectedType: { type: Type.STRING },
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                key: { type: Type.STRING },
                value: { type: Type.STRING },
                valueType: {
                  type: Type.STRING,
                  enum: [
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
                  ],
                },
                confidenceReasoning: { type: Type.STRING },
              },
              required: ["key", "value", "valueType"],
            },
          },
        },
        required: ["fields"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini API");

  const rawJson = JSON.parse(text);
  return CloudExtractionResponseSchema.parse(rawJson);
}
