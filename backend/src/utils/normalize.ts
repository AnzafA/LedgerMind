export function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

export function normalizeIdentifier(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/^(UPI|IMPS|NEFT|RTGS)[-_:\s]*/i, "");
}

export function normalizeAlias(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}
