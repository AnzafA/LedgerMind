// backend/scripts/test-parser.ts

import fs from "fs";
import path from "path";
import { detectParser } from "../src/parsers";
import { reconcile } from "../src/parsers/reconcile";

const samplePath =
  process.argv[2] ?? path.join("samples", "indian-bank-statement.csv");

if (!fs.existsSync(samplePath)) {
  console.error(`Sample not found: ${samplePath}`);
  process.exit(1);
}

const content = fs.readFileSync(samplePath, "utf-8");

const parser = detectParser(content, samplePath);
if (!parser) {
  console.error("No parser recognized this file format.");
  process.exit(1);
}

console.log(`Parser: ${parser.id}\n`);

const result = parser.parse(content);

console.log("=== Account Info ===");
console.log(JSON.stringify(result.accountInfo, null, 2));

console.log(`\n=== Transactions (${result.transactions.length}) ===`);
for (const tx of result.transactions) {
  const d = tx.date.toISOString().slice(0, 10);
  const amt = tx.amount.toFixed(2).padStart(12);
  const bal = (tx.balance ?? 0).toFixed(2).padStart(12);
  const desc = tx.description.slice(0, 60);
  console.log(`${d} | ${tx.direction.padEnd(6)} | ${amt} | ${bal} | ${desc}`);
}

console.log(`\n=== Warnings (${result.warnings.length}) ===`);
for (const w of result.warnings) console.log("  ⚠️ ", w);

console.log("\n=== Reconciliation ===");
const rec = reconcile(result);
console.log(rec.message);
console.log(`  Opening:  ${rec.openingBalance?.toFixed(2)}`);
console.log(`  Credits:  ${rec.credits.toFixed(2)}`);
console.log(`  Debits:   ${rec.debits.toFixed(2)}`);
console.log(`  Computed: ${rec.computedClosing?.toFixed(2)}`);
console.log(`  Expected: ${rec.closingBalance?.toFixed(2)}`);
console.log(`  Diff:     ${rec.difference?.toFixed(2)}`);

process.exit(rec.ok ? 0 : 2);