// backend/scripts/test-narration.ts

import fs from "fs";
import path from "path";
import { detectParser } from "../src/parsers";
import { extractNarration } from "../src/parsers/common/narration";

const samplePath =
  process.argv[2] ?? path.join("samples", "indian-bank-statement.csv");

if (!fs.existsSync(samplePath)) {
  console.error(`Sample not found: ${samplePath}`);
  process.exit(1);
}

const content = fs.readFileSync(samplePath, "utf-8");
const parser = detectParser(content, samplePath);
if (!parser) {
  console.error("No parser recognized this file.");
  process.exit(1);
}

const result = parser.parse(content);
const holder = result.accountInfo.holderName;

console.log(`Account holder: ${holder}\n`);
console.log(`Total transactions: ${result.transactions.length}\n`);

const seen = new Set<string>();
let selfTransfers = 0;
let bankCharges = 0;
let withCounterparty = 0;
let withAccount = 0;
let withPhone = 0;

for (const tx of result.transactions) {
  const n = extractNarration(tx.description, holder);

  if (n.isSelfTransfer) selfTransfers++;
  else if (n.isBankCharge) bankCharges++;
  else if (n.counterpartyName) withCounterparty++;
  if (n.counterpartyAccount) withAccount++;
  if (n.counterpartyPhone) withPhone++;

  // Print unique (name|account|mode) combos once for review
  const key = `${n.counterpartyName ?? "_"} | ${n.counterpartyAccount ?? "_"} | ${n.mode}`;
  if (n.counterpartyName && !seen.has(key)) {
    seen.add(key);
    console.log(
      `[${n.mode.padEnd(8)}] ${(n.counterpartyName ?? "").padEnd(35)} acct=${n.counterpartyAccount ?? "-"} phone=${n.counterpartyPhone ?? "-"} bank=${n.bankCode ?? "-"}`
    );
  }
}

console.log("\n=== Summary ===");
console.log(`Total: ${result.transactions.length}`);
console.log(`Self-transfers: ${selfTransfers}`);
console.log(`Bank charges: ${bankCharges}`);
console.log(`With counterparty name: ${withCounterparty}`);
console.log(`With counterparty account: ${withAccount}`);
console.log(`With phone: ${withPhone}`);

console.log("\n=== Full dump (first 30) ===\n");
for (const tx of result.transactions.slice(0, 30)) {
  const n = extractNarration(tx.description, holder);
  console.log(
    `${tx.direction} ${tx.amount.toFixed(2).padStart(12)} | ${n.mode.padEnd(8)} | ${(n.counterpartyName ?? "—").padEnd(30)} | ${tx.description.slice(0, 50)}`
  );
} 