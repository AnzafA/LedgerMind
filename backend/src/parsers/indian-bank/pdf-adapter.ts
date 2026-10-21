import { extractText, getDocumentProxy } from "unpdf";
import { ParsedAccountInfo, ParsedTransaction, ParseResult } from "../types.ts";

export async function parsePdfStatement(pdfBuffer: Buffer): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const { text } = await extractText(pdf, { mergePages: true });

  if (text.trim().length < 50) {
    throw new Error("Scanned image PDF detected. OCR is required.");
  }

  const lines: string[] = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  
  // 1. Broader Header Detection
  const headerIndex = lines.findIndex((l: string) => l.match(/(Date|Txn Date).*(Transaction Details|Narration|Particulars)/i));
  if (headerIndex === -1) throw new Error("Could not find the transaction table headers in this PDF.");

  const accountInfo: ParsedAccountInfo = {};
  
  // 2. Multi-Match Metadata Extraction
  for (const line of lines) {
    if (line.match(/Account No|Account Number/i) && !accountInfo.accountNumber) {
      const match = line.match(/\b\d{8,18}\b/);
      if (match) accountInfo.accountNumber = match[0];
    }
    if (line.match(/IFSC/i) && !accountInfo.ifsc) {
      const match = line.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/);
      if (match) accountInfo.ifsc = match[0];
    }
    if (line.match(/Account Holder Name|Customer Name/i) && !accountInfo.holderName) {
      accountInfo.holderName = line.replace(/(Account Holder Name|Customer Name)/i, "").trim();
    }
  }

  // Capture all balances, use first for opening and last for closing
  const balanceMatches = [...text.matchAll(/(?:Opening Balance|B\/F|Brought Forward|Ending Balance|Closing Balance|C\/F|Carried Forward)[^\d]*(?:INR)?\s*([\d,]+\.\d{2})/gi)];
  if (balanceMatches.length > 0) {
    accountInfo.openingBalance = parseFloat(balanceMatches[0][1].replace(/,/g, ""));
    if (balanceMatches.length > 1) {
      accountInfo.closingBalance = parseFloat(balanceMatches[balanceMatches.length - 1][1].replace(/,/g, ""));
    }
  }

  const transactions: ParsedTransaction[] = [];
  let prevBalance: number | null = accountInfo.openingBalance !== undefined ? accountInfo.openingBalance : null;

  let currentDateStr = "";
  let descBuffer: string[] = [];
  let amountBuffer: string[] = [];
  let rawBlockText = "";

  const dateRegex = /^(\d{1,2}[\s/-][A-Za-z]{3,9}[\s/-]\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i;
  const amountRegex = /([\d,]+\.\d{2})/g;

  function processBlock() {
    if (!currentDateStr || amountBuffer.length === 0) {
      currentDateStr = ""; descBuffer = []; amountBuffer = []; rawBlockText = "";
      return;
    }

    // Normalize date to JS Date
    let date = new Date(currentDateStr);
    if (isNaN(date.getTime())) date = new Date(); // Fallback for weird formats

    let amount = 0;
    let direction: "DEBIT" | "CREDIT" = "DEBIT";
    let balance = prevBalance || 0;
    
    // Fix Bug 1: Handle 2 or 3 amounts (Tx, [Zero], Balance)
    if (amountBuffer.length >= 2) {
      balance = parseFloat(amountBuffer[amountBuffer.length - 1].replace(/,/g, ""));
      // If there are 3 amounts, one is likely 0.00. Pick the non-zero one.
      const txCandidates = amountBuffer.slice(0, -1).map(a => parseFloat(a.replace(/,/g, "")));
      amount = txCandidates.find(a => a > 0) || txCandidates[0];
    } else {
      amount = parseFloat(amountBuffer[0].replace(/,/g, ""));
    }

    // Fix Bug 2: Update prevBalance IMMEDIATELY so future rows don't drift
    if (balance > 0) prevBalance = balance;

    // Determine Direction
    let directionFound = false;
    if (balance !== null && amount > 0) {
      const delta = balance - (prevBalance || balance); 
      // This math is tricky if we updated prevBalance. Let's do the math before updating.
    }

    // Re-doing math safely:
    const oldBalance = prevBalance;
    if (oldBalance !== null && amount > 0) {
      const delta = balance - oldBalance;
      if (Math.abs(delta - amount) < 0.05) { direction = "CREDIT"; directionFound = true; }
      else if (Math.abs(delta + amount) < 0.05) { direction = "DEBIT"; directionFound = true; }
    }

    if (!directionFound) {
      if (rawBlockText.match(/\bCr\b/i)) { direction = "CREDIT"; }
      else if (rawBlockText.match(/\bDr\b/i)) { direction = "DEBIT"; }
    }

    const description = descBuffer.join(" ").replace(/\s+/g, " ").trim();

    transactions.push({
      date,
      description: directionFound ? description : `${description} [NEEDS REVIEW: UNKNOWN DIRECTION]`,
      amount,
      direction,
      balance,
      parserId: "indian-bank/pdf-v1",
    });

    // Reset
    currentDateStr = ""; descBuffer = []; amountBuffer = []; rawBlockText = "";
  }

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Fix: Safer termination
    if (line.match(/^(Ending Balance|Closing Balance|Total|Grand Total)/i) && !line.match(/\d{2}/)) break;
    if (line.match(/(Date|Txn Date).*(Transaction Details|Narration|Particulars)/i)) continue;

    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      processBlock(); // Process the previous block
      
      currentDateStr = dateMatch[1];
      rawBlockText = line;
      let restOfLine = line.replace(dateMatch[1], "").trim();
      
      const amounts = restOfLine.match(amountRegex) || [];
      amountBuffer.push(...amounts);
      
      amounts.forEach(a => { restOfLine = restOfLine.replace(a, ""); });
      
      if (restOfLine.trim().length > 0) descBuffer.push(restOfLine.trim());
      
    } else if (currentDateStr) {
      // Continuation line
      rawBlockText += " " + line;
      const amounts = line.match(amountRegex) || [];
      amountBuffer.push(...amounts);
      
      let cleanLine = line;
      amounts.forEach(a => { cleanLine = cleanLine.replace(a, ""); });
      
      // Fix: Keep reference numbers (don't just strip everything non-alpha)
      if (cleanLine.trim().length > 0) descBuffer.push(cleanLine.trim());
    }
  }

  processBlock(); // Flush the last block

  return { parserId: "indian-bank/pdf-v1", accountInfo, transactions, warnings: [] };
}