// backend/src/parsers/types.ts

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number; // always positive
  direction: "DEBIT" | "CREDIT";
  balance?: number;
  reference?: string;
  parserId: string;
  sourceRowNumber?: number;
}

export interface ParsedAccountInfo {
  holderName?: string;
  accountNumber?: string;
  ifsc?: string;
  accountType?: string;
  branchName?: string;
  currency?: string;
  openingBalance?: number;
  closingBalance?: number;
}

export interface ParseResult {
  parserId: string;
  accountInfo: ParsedAccountInfo;
  transactions: ParsedTransaction[];
  warnings: string[];
}

export interface StatementParser {
  id: string;
  bank: string;
  detect(content: string, filename?: string): boolean;
  parse(content: string): ParseResult;
}