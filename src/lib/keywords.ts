/** Splits keywords on commas/newlines and drops repeats (ignoring case and extra spaces). */
export function parseKeywords(text: string): string[] {
  const seen = new Map<string, string>();
  for (const raw of text.split(/[\n,]+/)) {
    const k = raw.trim().replace(/\s+/g, " ");
    if (k && !seen.has(k.toLowerCase())) seen.set(k.toLowerCase(), k);
  }
  return [...seen.values()];
}
