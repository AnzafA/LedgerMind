import { extractText, getDocumentProxy } from "unpdf";
import { ParsedAccountInfo, ParsedTransaction, ParseResult } from "./types.ts";

export async function parseUniversalPdf(pdfBuffer: Buffer): Promise<ParseResult> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
  const { text } = await extractText(pdf, { mergePages: true });

  if (text.trim().length < 50) throw new Error("Scanned image PDF detected.");

  const lines: string[] = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  const accountInfo: ParsedAccountInfo = {};
  const warnings: string[] = [];

  const openMatch = text.match(/(?:Opening Balance|B\/F|Brought Forward)[^\d]*(?:INR)?\s*([\d,]+\.\d{2})/i);
  if (openMatch) accountInfo.openingBalance = parseFloat(openMatch[1].replace(/,/g, ""));
  
  const dateRegex = /^(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i;
  const amountRegex = /([\d,]+(?:\.\d{1,2})?)/g;

  const transactions: ParsedTransaction[] = [];
  let prevBalance: number | null = accountInfo.openingBalance !== undefined ? accountInfo.openingBalance : null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      let restOfLine = line.replace(dateMatch[1], "");
      const amounts = restOfLine.match(amountRegex);
      
      if (amounts && amounts.length >= 2) {
        const parsedAmounts = amounts.map((a: string) => parseFloat(a.replace(/,/g, "")));
        
        let validCandidates: { balance: number; amount: number; direction: "DEBIT"|"CREDIT" }[] = [];

        if (prevBalance !== null) {
          for (let b = 0; b < parsedAmounts.length; b++) {
            for (let t = 0; t < parsedAmounts.length; t++) {
              if (b === t) continue;
              const testBalance = parsedAmounts[b];
              const testAmount = parsedAmounts[t];
              const delta = testBalance - prevBalance;
              
              if (Math.abs(delta - testAmount) < 0.10) {
                validCandidates.push({ balance: testBalance, amount: testAmount, direction: "CREDIT" });
              } else if (Math.abs(delta + testAmount) < 0.10) {
                validCandidates.push({ balance: testBalance, amount: testAmount, direction: "DEBIT" });
              }
            }
          }
        }

        const uniqueCandidates = Array.from(new Set(validCandidates.map(c => `${c.balance}|${c.amount}|${c.direction}`))).map(str => {
          const [b, a, d] = str.split("|");
          return { balance: Number(b), amount: Number(a), direction: d as "DEBIT"|"CREDIT" };
        });

        let finalBalance = 0;
        let finalAmount = 0;
        let finalDirection: "DEBIT" | "CREDIT" = "DEBIT";
        let isValidated = true;
        let validationNotes: string[] = [];

        if (uniqueCandidates.length === 1) {
          finalBalance = uniqueCandidates[0].balance;
          finalAmount = uniqueCandidates[0].amount;
          finalDirection = uniqueCandidates[0].direction;
        } else if (uniqueCandidates.length > 1) {
          // FIX 1: Flag as unverified if ambiguous
          finalBalance = uniqueCandidates[0].balance;
          finalAmount = uniqueCandidates[0].amount;
          finalDirection = uniqueCandidates[0].direction;
          isValidated = false;
          validationNotes.push("Ambiguous math: multiple number pairs matched the balance delta.");
        } else {
          finalBalance = parsedAmounts[parsedAmounts.length - 1];
          finalAmount = parsedAmounts[parsedAmounts.length - 2];
          if (restOfLine.match(/\bCr\b/i) || restOfLine.match(/\+/)) finalDirection = "CREDIT";
          isValidated = false;
          validationNotes.push("Math failed: used positional fallback.");
        }

        if (isValidated) {
          prevBalance = finalBalance;
        }

        let desc = restOfLine;
        amounts.forEach((amtStr) => { desc = desc.replace(amtStr, ""); });
        desc = desc.replace(/[^a-zA-Z0-9 .&'-]/g, " ").replace(/\s+/g, " ").trim();

        transactions.push({
          date: new Date(dateMatch[1]),
          description: desc || "Unknown",
          amount: finalAmount,
          direction: finalDirection,
          balance: finalBalance,
          parserId: "universal/pdf-v1",
          isValidated,
          validationNotes
        });
      }
    }
  }

  if (transactions.length === 0) throw new Error("Could not extract valid transactions.");
  return { parserId: "universal/pdf-v1", accountInfo, transactions, warnings };
}