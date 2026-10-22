import { ParseResult, ParsedTransaction, StatementParser } from "./types.ts";

export const universalCsvParser: StatementParser = {
  id: "universal/csv-v1",
  bank: "UNKNOWN",

  // It only claims a file if it has common CSV headers
  detect(content: string): boolean {
    const lower = content.toLowerCase();
    return (
      lower.includes("date") &&
      (lower.includes("balance") || lower.includes("amount")) &&
      (lower.includes("withdrawal") || lower.includes("debit") || lower.includes("credit") || lower.includes("deposit"))
    );
  },

  parse(content: string): ParseResult {
    // Basic CSV line splitter (handles quotes)
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const csvData = lines.map(line => {
      const row = [];
      let cur = "", inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { row.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      row.push(cur.trim());
      return row;
    });

    // 1. Find the Header Row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(csvData.length, 20); i++) {
      const rowStr = csvData[i].join(" ").toLowerCase();
      if (rowStr.includes("date") && (rowStr.includes("balance") || rowStr.includes("amount"))) {
        headerIdx = i;
        break;
      }
    }
    
    if (headerIdx === -1) throw new Error("Could not detect CSV headers");
    const headers = csvData[headerIdx].map(h => h.toLowerCase());

    // 2. Map Columns Dynamically
    const colDate = headers.findIndex(h => h.includes("date"));
    const colDesc = headers.findIndex(h => h.includes("narration") || h.includes("particulars") || h.includes("description") || h.includes("details"));
    const colDebit = headers.findIndex(h => h.includes("withdrawal") || h.includes("debit") || h.includes("paid out"));
    const colCredit = headers.findIndex(h => h.includes("deposit") || h.includes("credit") || h.includes("paid in"));
    const colBalance = headers.findIndex(h => h.includes("balance"));
    const colAmount = headers.findIndex(h => h === "amount"); // Some banks just use "Amount"

    if (colDate === -1 || colBalance === -1) {
      throw new Error("Missing essential columns (Date/Balance)");
    }

    // 3. Parse the Rows
    const transactions: ParsedTransaction[] = [];
    const parseNum = (val: string) => parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;

    for (let i = headerIdx + 1; i < csvData.length; i++) {
      const row = csvData[i];
      if (!row[colDate] || row[colDate].toLowerCase().includes("total")) continue;

      const dateStr = row[colDate];
      let date = new Date(dateStr);
      if (isNaN(date.getTime())) date = new Date(); // Fallback

      let amount = 0;
      let direction: "DEBIT" | "CREDIT" = "DEBIT";

      if (colDebit !== -1 && colCredit !== -1) {
        const debitVal = parseNum(row[colDebit] || "0");
        const creditVal = parseNum(row[colCredit] || "0");
        if (creditVal > 0) { amount = creditVal; direction = "CREDIT"; }
        else { amount = debitVal; direction = "DEBIT"; }
      } else if (colAmount !== -1) {
        // Some banks use a single Amount column with Dr/Cr indicator
        amount = Math.abs(parseNum(row[colAmount] || "0"));
        direction = row[colAmount].toLowerCase().includes("cr") ? "CREDIT" : "DEBIT";
      }

      if (amount === 0) continue;

      const balance = parseNum(row[colBalance] || "0");
      const description = colDesc !== -1 ? row[colDesc] : "Unknown Transaction";

      transactions.push({
        date,
        description,
        amount,
        direction,
        balance,
        parserId: "universal/csv-v1"
      });
    }

    return {
      parserId: "universal/csv-v1",
      accountInfo: {},
      transactions,
      warnings: []
    };
  }
};