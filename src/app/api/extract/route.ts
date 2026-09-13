import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  extractionResponseSchema,
  type ExtractionResult,
} from "@/lib/gemini/extractionSchema";
import {
  buildExtractionPrompt,
  type ReconstructedBlock,
} from "@/lib/gemini/buildStructuredPrompt";
import { mergeFieldConfidence } from "@/lib/gemini/mergeConfidence";

export async function POST(req: NextRequest) {
  try {
    const { blocks } = (await req.json()) as { blocks: ReconstructedBlock[] };

    if (!blocks?.length) {
      return NextResponse.json({ error: "No blocks provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured in .env.local — Please add your Gemini API key from https://aistudio.google.com/app/apikey to .env.local",
        },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildExtractionPrompt(blocks);

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionResponseSchema,
      },
    });

    let parsed: ExtractionResult;
    try {
      parsed = JSON.parse(response.text ?? "{}");
    } catch {
      return NextResponse.json(
        { error: "Model returned non-parseable JSON" },
        { status: 502 },
      );
    }

    const withMergedConfidence: ExtractionResult = {
      ...parsed,
      sections: (parsed.sections ?? []).map((section) => ({
        ...section,
        entries: (section.entries ?? []).map((entry) => ({
          ...entry,
          fields: (entry.fields ?? []).map((field) => mergeFieldConfidence(field)),
        })),
      })),
    };

    return NextResponse.json({ success: true, ...withMergedConfidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
