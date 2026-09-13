import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  extractionResponseSchema,
  type ExtractionResult,
} from "@/lib/gemini/extractionSchema";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = (await req.json()) as {
      imageBase64: string;
      mimeType: "image/png" | "image/jpeg" | "image/webp";
    };

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
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

    const prompt = `This image is a page whose text a conventional OCR engine
could not reliably read — this can happen with any kind of document: a
photographed physical card, a scanned form, a low-quality printout, a
handwritten note, a receipt, whatever it turns out to be. Do not assume a
category in advance.

Read the image directly and extract its structure:
1. Decide "documentType" yourself in your own words based only on what you
   see — do not force it into any predefined category.
2. Group related content into sections and entries that reflect the document's
   actual visual structure.
3. EVERY field needs its own specific, concept-accurate label drawn from what
   is actually written near that value. Never reuse one label across values
   that aren't the same concept just because they're physically close to the
   same heading.
4. If a value has no clear label of its own, use "Unlabeled" rather than
   guessing a nearby heading's word.
5. If the document renders the same field in more than one language or
   script, prefer the most complete/legible rendering for "value", and use
   "label" to note which field it is.
6. Long ID/reference/account numbers, if present, should still be
   extracted as-is; redaction or masking is a downstream decision, not
   something to apply here.
7. Set confidence per field based on how legible that specific region of
   the image actually was, not a flat default.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "image/png",
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
              },
            },
          ],
        },
      ],
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

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vision extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
