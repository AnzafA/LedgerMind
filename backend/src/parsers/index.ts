// backend/src/parsers/index.ts

import { StatementParser } from "./types";
import { indianBankAccountStatementCsvV1 } from "./indian-bank/account-statement/csv-v1";

export const PARSERS: StatementParser[] = [indianBankAccountStatementCsvV1];

export function detectParser(
  content: string,
  filename?: string
): StatementParser | null {
  for (const p of PARSERS) {
    if (p.detect(content, filename)) return p;
  }
  return null;
}