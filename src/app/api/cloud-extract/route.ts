import { NextResponse } from "next/server";
import { callGeminiExtract } from "@/lib/cloudExtract/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filename, rawText, existingFieldKeys } = body;

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json(
        { error: "rawText string is required" },
        { status: 400 },
      );
    }

    const result = await callGeminiExtract(
      filename || "document",
      rawText,
      existingFieldKeys,
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Cloud extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
