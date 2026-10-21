import "dotenv/config";
import fs from "fs";
import path from "path";
import { detectParser } from "../src/parsers/index.ts";
import { extractNarration } from "../src/parsers/common/narration.ts";

const samplePath = process.argv[2] || path.join("samples", "indian-bank-statement.csv");

async function main() {
  const content = fs.readFileSync(samplePath, "utf8");
  const parser = detectParser(content, samplePath);
  if (!parser) throw new Error("Parser not found");

  const parsed = parser.parse(content);
  const holder = parsed.accountInfo.holderName;

  let imported = 0;
  let selfTransfer = 0;
  let bankCharge = 0;
  let needsReview = 0;
  const reviewRows: any[] = [];

  console.log(`Total transactions parsed from CSV: ${parsed.transactions.length}\n`);

  for (const tx of parsed.transactions) {
    const n = extractNarration(tx.description, holder);

    if (n.isSelfTransfer) {
      selfTransfer++;
    } else if (n.isBankCharge) {
      bankCharge++;
    } else if (n.counterpartyName === "Branch Transfer (Needs Review)") {
      needsReview++;
      reviewRows.push({ date: tx.date.toISOString().slice(0, 10), amount: tx.amount, desc: tx.description });
    } else {
      imported++;
    }
  }

  const totalAccountedFor = imported + selfTransfer + bankCharge + needsReview;

  console.log("=== AUDIT RESULT ===");
  console.log(`Total CSV Rows:       ${parsed.transactions.length}`);
  console.log(`1. Imported (Real):   ${imported}`);
  console.log(`2. Self-Transfers:    ${selfTransfer} (Ignored)`);
  console.log(`3. Bank Charges:      ${bankCharge} (Ignored)`);
  console.log(`4. Needs Review:      ${needsReview} (Bank provided no name)`);
  console.log(`-------------------------`);
  console.log(`Total Accounted For:  ${totalAccountedFor}`);
  console.log(`Discrepancy:          ${parsed.transactions.length - totalAccountedFor}`);
  
  if (parsed.transactions.length !== totalAccountedFor) {
    console.log("\n⚠️ WARNING: Rows are missing from the pipeline!");
  } else {
    console.log("\n✅ PERFECT MATH: 100% of rows are accounted for.");
  }

  if (reviewRows.length > 0) {
    console.log("\n=== 'Needs Review' Transactions (The Bank's fault) ===");
    for (const r of reviewRows) {
      console.log(`[${r.date}] ₹${r.amount} | RAW TEXT: ${r.desc.substring(0, 100)}...`);
    }
  }
}

main().catch(console.error);