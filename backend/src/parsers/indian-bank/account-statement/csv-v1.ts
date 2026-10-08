// backend/src/parsers/indian-bank/account-statement/csv-v1.ts

import {
  ParsedAccountInfo,
  ParsedTransaction,
  ParseResult,
  StatementParser,
} from "../../types";

const PARSER_ID = "indian-bank/account-statement/csv-v1";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const DATE_RE = /^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{2,4})$/;
const AMOUNT_PREFIX_RE = /^(?:\+|-)?\s*INR\s*([\d,]+(?:\.\d{1,2})?)$/i;
const AMOUNT_SUFFIX_RE = /^([\d,]+(?:\.\d{1,2})?)\s*INR$/i;

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "-") return null;
  const m = t.match(AMOUNT_PREFIX_RE) ?? t.match(AMOUNT_SUFFIX_RE);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(num) ? null : num;
}

function parseDate(raw: string): Date | null {
  const m = raw.trim().match(DATE_RE);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  return new Date(Date.UTC(year, month, day));
}

export const indianBankAccountStatementCsvV1: StatementParser = {
  id: PARSER_ID,
  bank: "INDIAN_BANK",

  detect(content: string): boolean {
    return (
      content.includes("ACCOUNT STATEMENT") &&
      content.includes("Transaction Details") &&
      content.includes("Debits") &&
      content.includes("Credits")
    );
  },

  parse(content: string): ParseResult {
    const lines = content.split(/\r?\n/);
    const warnings: string[] = [];
    const accountInfo: ParsedAccountInfo = {};
    const transactions: ParsedTransaction[] = [];

    let headerSeen = false;
    let lastBalance: number | null = null;

    let curDate: Date | null = null;
    let curDescParts: string[] = [];
    let curAmounts: number[] = [];
    let curStartRow = -1;

    function flush() {
      if (!curDate) return;

      const description = curDescParts.join(" ").replace(/\s+/g, " ").trim();

      if (curAmounts.length < 2) {
        warnings.push(
          `Row ${curStartRow}: expected amount + balance, found ${curAmounts.length}`
        );
        curDate = null;
        curDescParts = [];
        curAmounts = [];
        return;
      }

      const balance = curAmounts[curAmounts.length - 1];
      const amount = curAmounts[curAmounts.length - 2];
      let direction: "DEBIT" | "CREDIT" = "DEBIT";

      if (lastBalance !== null) {
        const delta = balance - lastBalance;
        if (Math.abs(delta - amount) < 0.01) direction = "CREDIT";
        else if (Math.abs(delta + amount) < 0.01) direction = "DEBIT";
        else
          warnings.push(
            `Row ${curStartRow}: balance delta ${delta.toFixed(2)} ≠ amount ${amount.toFixed(2)} — defaulting to DEBIT`
          );
      }

      transactions.push({
        date: curDate,
        description,
        amount,
        direction,
        balance,
        parserId: PARSER_ID,
        sourceRowNumber: curStartRow,
      });

      lastBalance = balance;
      curDate = null;
      curDescParts = [];
      curAmounts = [];
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const fields = splitCSVLine(line);
      const first = (fields[0] ?? "").trim();

      // --- Metadata section ---
      if (!headerSeen) {
        if (
          first === "Date" &&
          (fields[1] ?? "").includes("Transaction Details")
        ) {
          headerSeen = true;
          if (accountInfo.openingBalance !== undefined) {
            lastBalance = accountInfo.openingBalance;
          }
          continue;
        }

        if (first === "Account Holder Name") {
          const parts: string[] = [];
          if (fields[2]?.trim()) parts.push(fields[2].trim());
          if (i + 1 < lines.length) {
            const nxt = splitCSVLine(lines[i + 1]);
            const n0 = (nxt[0] ?? "").trim();
            const n1 = (nxt[1] ?? "").trim();
            const n2 = (nxt[2] ?? "").trim();
            if (!n0 && !n1 && n2) parts.push(n2);
          }
          accountInfo.holderName = parts.join(" ").trim();
        }

        if (first === "Account Number" && fields[2]?.trim())
          accountInfo.accountNumber = fields[2].trim();
        if (first === "IFSC" && fields[2]?.trim())
          accountInfo.ifsc = fields[2].trim();
        if (first === "Account Type" && fields[2]?.trim())
          accountInfo.accountType = fields[2].trim();
        if (first === "Branch Name" && fields[2]?.trim())
          accountInfo.branchName = fields[2].trim();
        if (first === "Account Currency" && fields[2]?.trim())
          accountInfo.currency = fields[2].trim();

        for (const f of fields) {
          const label = f.trim();
          if (label === "Opening Balance") {
            const amt = parseAmount(fields[fields.length - 1]);
            if (amt !== null) accountInfo.openingBalance = amt;
          } else if (label === "Ending Balance") {
            const amt = parseAmount(fields[fields.length - 1]);
            if (amt !== null) accountInfo.closingBalance = amt;
          }
        }

        continue;
      }

      // --- Transaction section ---

      // Skip repeated header rows
            // --- Transaction section ---

      // Skip repeated header rows
      if (
        first === "Date" &&
        (fields[1] ?? "").includes("Transaction Details")
      ) {
        continue;
      }

      // Stop at the footer summary — these are not transactions
      if (
        first === "Ending Balance" ||
        first === "Opening Balance" ||
        first === "Total" ||
        first === "Total Debits" ||
        first === "Total Credits"
      ) {
        flush();
        break;
      }

      const rowDate = parseDate(first);
      const rowAmounts: number[] = [];
      const rowDesc: string[] = [];

      for (let j = 0; j < fields.length; j++) {
        const f = (fields[j] ?? "").trim();
        if (!f) continue;
        if (j === 0 && rowDate) continue;

        const amt = parseAmount(f);
        if (amt !== null) rowAmounts.push(amt);
        else if (f !== "-") rowDesc.push(f);
      }

      if (rowDate) {
        flush();
        curDate = rowDate;
        curStartRow = i + 1;
        curDescParts = rowDesc;
        curAmounts = rowAmounts;
      } else if (curDate) {
        if (rowDesc.length > 0) curDescParts.push(...rowDesc);
        if (rowAmounts.length > 0) curAmounts.push(...rowAmounts);
      }
    }

    flush();

    return { parserId: PARSER_ID, accountInfo, transactions, warnings };
  },
};