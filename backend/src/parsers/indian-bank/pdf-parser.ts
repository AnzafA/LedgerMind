import { extractText, getDocumentProxy } from "unpdf";
import { ParsedAccountInfo, ParsedTransaction, ParseResult } from "../types.ts";

export async function parsePdfStatement(pdfBuffer: Buffer): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const { text } = await extractText(pdf, { mergePages: true });

  if (text.trim().length < 50) {
    throw new Error("Scanned image PDF detected. OCR is required.");
  }

  const lines: string[] = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  
  const headerRegex = /(Date|Txn Date).*?(Transaction Details|Narration|Particulars|Description)/i;
  const headerIndex = lines.findIndex((l: string) => headerRegex.test(l));
  if (headerIndex === -1) throw new Error("Could not find the transaction table headers in this PDF.");

  const accountInfo: ParsedAccountInfo = {};
  const warnings: string[] = [];

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

        let date = new Date(0); // Default to 1970
    const dateParts = currentDateStr.match(/(\d{1,2})[\s/-]([A-Za-z]{3,9}|\d{1,2})[\s/-](\d{2,4})/);
    
    if (dateParts) {
      const day = parseInt(dateParts[1], 10);
      let month = 0;
      
      // Handle both "Oct" and "10" for month
      if (isNaN(parseInt(dateParts[2], 10))) {
        const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
        month = months.indexOf(dateParts[2].toLowerCase().substring(0, 3));
      } else {
        month = parseInt(dateParts[2], 10) - 1;
      }
      
      let year = parseInt(dateParts[3], 10);
      if (year < 100) year += 2000;
      
      date = new Date(Date.UTC(year, month, day));
    } else {
      warnings.push(`Invalid date format: '${currentDateStr}'. Defaulting to 1970-01-01.`);
    }

    let amount = 0;
    let balance: number | null = null;
    let direction: "DEBIT" | "CREDIT" = "DEBIT";
    let directionFound = false;

    const parsedAmounts = amountBuffer.map(a => parseFloat(a.replace(/,/g, "")));

    // FIXED: Strict Single-Amount Handling
    if (parsedAmounts.length === 1) {
      if (prevBalance !== null) {
        // If there's only one number, it's the new balance. Amount is 0.
        balance = parsedAmounts[0];
        amount = 0;
        directionFound = true;
        direction = "DEBIT";
      } else {
        amount = parsedAmounts[0];
        balance = parsedAmounts[0];
        directionFound = true;
      }
    } else if (parsedAmounts.length >= 2) {
      const testBalance = parsedAmounts[parsedAmounts.length - 1];
      
      if (prevBalance !== null) {
        const delta = testBalance - prevBalance;
        const absDelta = Math.abs(delta);
        const match = parsedAmounts.slice(0, -1).find(a => Math.abs(a - absDelta) < 0.05);
        
        if (match !== undefined) {
          balance = testBalance;
          amount = match;
          direction = delta > 0 ? "CREDIT" : "DEBIT";
          directionFound = true;
        }
      }
      
      // Fallback if Math fails
      if (!directionFound) {
         balance = parsedAmounts[parsedAmounts.length - 1];
         amount = parsedAmounts[parsedAmounts.length - 2];
         
         const amtString = amountBuffer[amountBuffer.length - 2] || amountBuffer[0];
         if (amtString) {
            const amtIndex = rawBlockText.lastIndexOf(amtString);
            if (amtIndex !== -1) {
              const before = rawBlockText.substring(Math.max(0, amtIndex - 15), amtIndex);
              const after = rawBlockText.substring(amtIndex + amtString.length, amtIndex + amtString.length + 15);
              if (before.includes("-")) { direction = "CREDIT"; directionFound = true; }
              else if (after.includes("-")) { direction = "DEBIT"; directionFound = true; }
            }
         }
      }
    }

    if (balance !== null && Number.isFinite(balance)) {
      prevBalance = balance;
    }

    let finalDesc = descBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (!directionFound) {
      warnings.push(`Unknown direction for row near ${currentDateStr}. Defaulted to DEBIT.`);
      finalDesc += " [NEEDS REVIEW: UNKNOWN DIRECTION]";
    }

    transactions.push({
      date,
      description: finalDesc,
      amount,
      direction,
      balance: balance || 0,
      parserId: "indian-bank/pdf-v1",
    });

    currentDateStr = ""; descBuffer = []; amountBuffer = []; rawBlockText = "";
  }

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^(Ending Balance|Closing Balance|Total|Grand Total)/i)) break;
    if (headerRegex.test(line)) continue;

    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      processBlock(); 
      
      currentDateStr = dateMatch[1];
      rawBlockText = line;
      let restOfLine = line.replace(dateMatch[1], "").trim();
      
      const amounts = restOfLine.match(amountRegex) || [];
      amountBuffer.push(...amounts);
      
      amounts.forEach(a => { restOfLine = restOfLine.replace(a, ""); });
      
      if (restOfLine.trim().length > 0) descBuffer.push(restOfLine.trim());
      
    } else if (currentDateStr) {
      rawBlockText += " " + line;
      const amounts = line.match(amountRegex) || [];
      amountBuffer.push(...amounts);
      
      let cleanLine = line;
      amounts.forEach(a => { cleanLine = cleanLine.replace(a, ""); });
      
      if (cleanLine.trim().length > 0) descBuffer.push(cleanLine.trim());
    }
  }

  processBlock(); 

  return { parserId: "indian-bank/pdf-v1", accountInfo, transactions, warnings };
}