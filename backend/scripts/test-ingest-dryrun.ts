// backend/scripts/test-ingest-dryrun.ts

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

interface ProposedEntity {
  key: string;
  name: string;
  accounts: Set<string>;
  phones: Set<string>;
  bankCodes: Set<string>;
  modes: Set<string>;
  txCount: number;
  totalSent: number;
  totalReceived: number;
}

const entities = new Map<string, ProposedEntity>();
let skippedSelfTransfers = 0;
let skippedBankCharges = 0;
let unattributed = 0;

for (const tx of result.transactions) {
  const n = extractNarration(tx.description, holder);

  if (n.isSelfTransfer) { skippedSelfTransfers++; continue; }
  if (n.isBankCharge)   { skippedBankCharges++;   continue; }

  if (!n.counterpartyName && !n.counterpartyAccount && !n.counterpartyPhone) {
    unattributed++;
    continue;
  }

  const key =
    n.mode === "BILLDESK" || n.mode === "PAYTM"
      ? `mode:${n.mode}`
      : n.counterpartyAccount ? `acct:${n.counterpartyAccount}` :
        n.counterpartyPhone   ? `phone:${n.counterpartyPhone}` :
        n.counterpartyName    ? `name:${n.counterpartyName.toUpperCase()}` :
        `tx:${tx.sourceRowNumber}`;

  if (!entities.has(key)) {
    entities.set(key, {
      key,
      name: n.counterpartyName ?? "(unknown)",
      accounts: new Set(),
      phones: new Set(),
      bankCodes: new Set(),
      modes: new Set(),
      txCount: 0,
      totalSent: 0,
      totalReceived: 0,
    });
  }

  const e = entities.get(key)!;
  if (n.counterpartyName) {
    if (!e.name || e.name === "(unknown)" || n.counterpartyName.length > e.name.length) {
      e.name = n.counterpartyName;
    }
  }
  if (n.counterpartyAccount) e.accounts.add(n.counterpartyAccount);
  if (n.counterpartyPhone)   e.phones.add(n.counterpartyPhone);
  if (n.bankCode)            e.bankCodes.add(n.bankCode);
  e.modes.add(n.mode);
  e.txCount++;
  if (tx.direction === "DEBIT")  e.totalSent     += tx.amount;
  else                            e.totalReceived += tx.amount;
}

console.log(`Account holder: ${holder}`);
console.log(`Total transactions: ${result.transactions.length}`);
console.log(`Skipped self-transfers: ${skippedSelfTransfers}`);
console.log(`Skipped bank charges:   ${skippedBankCharges}`);
console.log(`Unattributed rows:      ${unattributed}`);
console.log(`Proposed entities:      ${entities.size}\n`);

const sorted = Array.from(entities.values()).sort(
  (a, b) => (b.totalSent + b.totalReceived) - (a.totalSent + a.totalReceived)
);

console.log("=== Proposed entities (sorted by volume) ===\n");
for (const e of sorted) {
  const acct = [...e.accounts].join(", ") || "-";
  const phone = [...e.phones].join(", ") || "-";
  const bank = [...e.bankCodes].join(", ") || "-";
  const mode = [...e.modes].join(", ");
  console.log(
    `${e.name.padEnd(35)} | tx=${String(e.txCount).padStart(3)} | sent=${e.totalSent.toFixed(2).padStart(12)} | rcv=${e.totalReceived.toFixed(2).padStart(12)} | acct=${acct} | phone=${phone} | ${bank} | ${mode}`
  );
}
