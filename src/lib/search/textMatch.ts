export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesQuery(query: string, ...parts: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((part) => part.toLowerCase().includes(q));
}

export function countOccurrences(haystack: string, query: string): number {
  const q = query.trim();
  if (!q) return 0;
  const re = new RegExp(escapeRegExp(q), "gi");
  return haystack.match(re)?.length ?? 0;
}

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}
