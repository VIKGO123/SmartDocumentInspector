import type { Block } from "@/lib/types";

export async function hashFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function layoutFingerprint(blocks: Block[]): string {
  const sketch = blocks
    .map((b) => {
      const x = Math.round(b.bbox.x / 40);
      const y = Math.round(b.bbox.y / 40);
      return `${b.type}@${b.bbox.page}:${x},${y}`;
    })
    .join("|");
  return fnv1a(sketch);
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}
