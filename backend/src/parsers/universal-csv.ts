import { ParseResult, ParsedTransaction, StatementParser } from "./types.ts";

export const universalCsvParser: StatementParser = {
  id: "universal/csv-v1",
  bank: "UNKNOWN",

  detect(content: string): boolean {
    const lower = content.toLowerCase();
    return lower.includes("date") && (lower.includes("balance") || lower.includes("amount"));
  },

  parse(content: string): ParseResult {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    
    // Find the actual header row first
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes("date") && (lower.includes("balance") || lower.includes("amount"))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) throw new Error("Could not detect CSV headers");

    // Infer delimiter from the HEADER row, not the first line
    const headerLine = lines[headerIdx];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    let delimiter = ",";
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

    // Parse the CSV data using the detected delimiter
    const csvData = lines.map(line => {
      const row = [];
      let cur = "", inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === delimiter && !inQuotes) { row.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      row.push(cur.trim());
      return row;
    });

    const headers = csvData[headerIdx].map(h => h.toLowerCase());
    const colDate = headers.findIndex(h => h.includes("date"));
    const colDesc = headers.findIndex(h => h.includes("narration") || h.includes("particulars") || h.includes("description") || h.includes("details"));
    const colDebit = headers.findIndex(h => h.includes("withdrawal") || h.includes("debit"));
    const colCredit = headers.findIndex(h => h.includes("deposit") || h.includes("credit"));
    const colBalance = headers.findIndex(h => h.includes("balance"));
    const colAmount = headers.findIndex(h => h === "amount");
    const colType = headers.findIndex(h => h.includes("type") || h.includes("dr/cr") || h.includes("drcr"));

    if (colDate === -1) throw new Error("Missing Date column");

    const transactions: ParsedTransaction[] = [];
    const warnings: string[] = [];

    const parseNum = (val: string) => {
      if (!val) return null;
      const clean = val.replace(/[^0-9.-]/g, "");
      if (!clean) return null;
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    };

    // STRICT Date Parser (Rejects Feb 31)
    const parseStrictDate = (str: string): Date | null => {
      if (!str) return null;
      
      // Matches DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
      const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (dmy) {
        const d = Number(dmy[1]), m = Number(dmy[2]) - 1;
        let y = Number(dmy[3]);
        if (y < 100) y += 2000;
        
        const test = new Date(y, m, d);
        // Strict validation: Ensure JS didn't auto-correct an invalid date (like Feb 31 -> Mar 3)
        if (test.getFullYear() === y && test.getMonth() === m && test.getDate() === d) return test;
        return null;
      }

      // Matches YYYY-MM-DD
      const ymd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (ymd) {
        const y = Number(ymd[1]), m = Number(ymd[2]) - 1, d = Number(ymd[3]);
        const test = new Date(y, m, d);
        if (test.getFullYear() === y && test.getMonth() === m && test.getDate() === d) return test;
        return null;
      }

      return null;
    };

    for (let i = headerIdx + 1; i < csvData.length; i++) {
      const row = csvData[i];
      const rawDate = row[colDate];
      
      const date = parseStrictDate(rawDate);
      if (!date) {
        warnings.push(`Invalid/ambiguous date: '${rawDate}'. Row skipped.`);
        continue; 
      }

      let amount = 0;
      let direction: "DEBIT" | "CREDIT" = "DEBIT";
      let isValidated = true;
      let validationNotes: string[] = [];

      if (colDebit !== -1 && colCredit !== -1) {
        const dVal = parseNum(row[colDebit]);
        const cVal = parseNum(row[colCredit]);
        if (cVal !== null && cVal > 0) { amount = cVal; direction = "CREDIT"; }
        else if (dVal !== null && dVal > 0) { amount = dVal; direction = "DEBIT"; }
        else { continue; }
      } else if (colAmount !== -1) {
        const aVal = parseNum(row[colAmount]);
        if (aVal === null) continue;
        amount = Math.abs(aVal);
        if (colType !== -1) {
          direction = row[colType].toLowerCase().includes("cr") ? "CREDIT" : "DEBIT";
        } else {
          direction = row[colAmount].toLowerCase().includes("cr") ? "CREDIT" : "DEBIT";
        }
      } else { continue; }

      const balanceVal = parseNum(row[colBalance]);
      let balance: number | undefined = undefined;
      
      if (balanceVal === null) {
        isValidated = false;
        validationNotes.push("Missing running balance.");
      } else {
        balance = balanceVal;
      }

      transactions.push({
        date,
        description: colDesc !== -1 ? row[colDesc] : "Unknown",
        amount,
        direction,
        balance,
        parserId: "universal/csv-v1",
        isValidated,
        validationNotes
      });
    }

    return { parserId: "universal/csv-v1", accountInfo: {}, transactions, warnings };
  }
};