import {
  ParsedAccountInfo,
  ParsedTransaction,
  ParseResult,
  StatementParser,
} from "../../types.ts";

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

    // Helper to find the value next to a label dynamically
    function getNextValue(fields: string[]): string | undefined {
      for (let i = 1; i < fields.length; i++) {
        const val = fields[i].trim();
        if (val && val !== "-" && !val.includes("INR")) return val;
      }
      return undefined;
    }

    function flush() {
      if (!curDate) return;

      const description = curDescParts.join(" ").replace(/\s+/g, " ").trim();
      let amount = 0;
      let balance = 0;

      if (curAmounts.length === 1) {
        balance = curAmounts[0];
      } else if (curAmounts.length >= 2) {
        balance = curAmounts[curAmounts.length - 1];
        amount = curAmounts[curAmounts.length - 2];
      } else {
        warnings.push(`Row ${curStartRow}: no amounts found`);
        curDate = null;
        curDescParts = [];
        curAmounts = [];
        return;
      }

      let direction: "DEBIT" | "CREDIT" = "DEBIT";

      if (lastBalance !== null) {
        const delta = balance - lastBalance;
        if (Math.abs(delta - amount) < 0.01) direction = "CREDIT";
        else if (Math.abs(delta + amount) < 0.01) direction = "DEBIT";
        else if (amount === 0) direction = "DEBIT";
        else {
          warnings.push(
            `Row ${curStartRow}: balance delta ${delta.toFixed(2)} != amount ${amount.toFixed(2)}`
          );
        }
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
        if (first === "Date" && (fields[1] ?? "").includes("Transaction Details")) {
          headerSeen = true;
          if (accountInfo.openingBalance !== undefined) {
            lastBalance = accountInfo.openingBalance;
          }
          continue;
        }

        if (first === "Account Holder Name") {
          const val = getNextValue(fields);
          if (val) accountInfo.holderName = val;
        }
        if (first === "Account Number") {
          const val = getNextValue(fields);
          if (val) accountInfo.accountNumber = val;
        }
        if (first === "Account Type") {
          const val = getNextValue(fields);
          if (val) accountInfo.accountType = val;
        }
        if (first === "Branch Name") {
          const val = getNextValue(fields);
          if (val) accountInfo.branchName = val;
        }
        if (first === "IFSC") {
          const val = getNextValue(fields);
          if (val) accountInfo.ifsc = val;
        }
        if (first === "Account Currency") {
          const val = getNextValue(fields);
          if (val) accountInfo.currency = val;
        }

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
      if (first === "Date" && (fields[1] ?? "").includes("Transaction Details")) {
        continue;
      }

      // Stop at the footer summary
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
        if (amt !== null) {
          rowAmounts.push(amt);
        } else if (f !== "-") {
          rowDesc.push(f);
        }
      }

      if (rowDate) {
        // Merge split transactions on the same day
        if (curDate && rowDate.getTime() === curDate.getTime() && curAmounts.length === 1) {
          if (rowDesc.length > 0) curDescParts.push(...rowDesc);
          if (rowAmounts.length > 0) curAmounts.push(...rowAmounts);
          continue;
        }
        
        flush();
        curDate = rowDate;
        curStartRow = i + 1;
        curDescParts = rowDesc;
        curAmounts = rowAmounts;
      } else if (curDate) {
        if (rowDesc.length > 0) curDescParts.push(...rowDesc);
        if (rowAmounts.length > 0) curAmounts.push(...rowAmounts);
      }
    } // <--- THIS WAS THE MISSING BRACE!

    flush();

    return { parserId: PARSER_ID, accountInfo, transactions, warnings };
  },
};