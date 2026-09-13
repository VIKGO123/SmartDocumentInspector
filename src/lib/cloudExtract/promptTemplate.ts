export function buildCloudExtractPrompt(
  filename: string,
  rawText: string,
  existingFieldKeys?: string[],
): string {
  const existingContext =
    existingFieldKeys && existingFieldKeys.length > 0
      ? `Local rule-based pipeline already extracted the following keys: ${existingFieldKeys.join(
          ", ",
        )}. Focus on extracting fields or synthesized insights that local regex/rule schemas may have missed.`
      : "Extract all key information, metadata, and synthesized facts.";

  return `You are an expert document extraction engine. Analyze the following document text and extract all important key-value fields, metadata, entity names, amounts, dates, and synthesized facts.

Document Filename: ${filename}
${existingContext}

Guidelines:
1. Extract both explicit verbatim values and high-value inferred facts (e.g. candidate specialization, total summary).
2. Choose appropriate valueType for each field: date, money, email, phone, url, id, person, org, location, table, or text.
3. Be concise and precise with field keys and values.

Document Raw Text:
---
${rawText}
---`;
}
