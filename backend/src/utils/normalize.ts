// backend/src/utils/normalize.ts

export function normalizeName(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

export function normalizeAlias(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeIdentifier(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/^(UPI|IMPS|NEFT|RTGS|P2A|P2M)[-_:\s/]*/i, "")
    .replace(/[\s\-_:/]/g, "");
}

/**
 * Tokenize a name-like string into non-empty tokens.
 * "P KUMAR"       -> ["P", "KUMAR"]
 * "Pankaj Kumar"  -> ["PANKAJ", "KUMAR"]
 */
export function tokenizeName(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((t) => t.length > 0);
}

/**
 * Token-subset match.
 * "P KUMAR" vs "PANKAJ KUMAR" -> true  (P is prefix of PANKAJ, KUMAR matches)
 * "RAHUL KUMAR" vs "RAHUL SHARMA" -> false
 *
 * Rule: every token in `short` must be a prefix of some token in `long`.
 */
export function isTokenSubset(short: string[], long: string[]): boolean {
  if (short.length === 0 || long.length === 0) return false;
  if (short.length > long.length) return false;

  return short.every((sToken) =>
    long.some((lToken) => lToken === sToken || lToken.startsWith(sToken))
  );
}