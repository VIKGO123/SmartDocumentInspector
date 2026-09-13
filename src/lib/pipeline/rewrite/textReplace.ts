export function replaceOnce(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  const i = haystack.indexOf(needle);
  if (i < 0) return haystack;
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function replaceWordXmlText(xml: string, search: string, replacement: string): string {
  if (!search) return xml;
  if (xml.includes(search)) {
    const i = xml.indexOf(search);
    return xml.slice(0, i) + escapeXml(replacement) + xml.slice(i + search.length);
  }

  if (typeof DOMParser === "undefined") return xml;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return xml;
  const nodes = [
    ...doc.getElementsByTagName("w:t"),
    ...doc.getElementsByTagName("t"),
  ];
  if (!nodes.length) return xml;

  const pieces = nodes.map((node) => node.textContent ?? "");
  const full = pieces.join("");
  const start = full.indexOf(search);
  if (start < 0) return xml;

  const end = start + search.length;
  let cursor = 0;
  let remaining = replacement;
  for (let i = 0; i < nodes.length; i += 1) {
    const len = pieces[i].length;
    const nodeStart = cursor;
    const nodeEnd = cursor + len;
    cursor = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end) continue;
    if (nodeStart >= start && nodeEnd <= end) {
      nodes[i].textContent = remaining;
      remaining = "";
      continue;
    }
    const localStart = Math.max(0, start - nodeStart);
    const localEnd = Math.min(len, end - nodeStart);
    const prefix = pieces[i].slice(0, localStart);
    const suffix = pieces[i].slice(localEnd);
    nodes[i].textContent = `${prefix}${remaining}${suffix}`;
    remaining = "";
  }

  return new XMLSerializer().serializeToString(doc);
}

export function extractDocBinaryText(data: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i + 1 < data.length; i += 1) {
    const chars: string[] = [];
    let j = i;
    while (j + 1 < data.length) {
      const code = data[j] | (data[j + 1] << 8);
      if (code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127)) {
        chars.push(String.fromCharCode(code));
        j += 2;
      } else {
        break;
      }
    }
    if (chars.length >= 5) {
      chunks.push(chars.join("").replace(/\s+/g, " ").trim());
      i = j;
    }
  }
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const k = c.toLowerCase();
    if (seen.has(k) || c.length < 5) return false;
    seen.add(k);
    return true;
  }).join("\n");
}
