import "dotenv/config";
import fs from "fs";
import path from "path";
import { query, execute, newId, now } from "../src/db/exasol.ts";
import { importStatement } from "../src/services/import-statement.ts";

async function main() {
  const userId = newId();
  const t = now();
  await execute(
    `INSERT INTO LEDGERMIND.USERS (ID, EMAIL, NAME, CREATED_AT, UPDATED_AT) VALUES ('${userId}', 'demo@ledgermind.dev', 'Demo User', '${t}', '${t}')`
  );
  console.log("Demo user:", userId);

  const samplePath = path.join("samples", "indian-bank-statement.csv");
  const content = fs.readFileSync(samplePath, "utf8");

  console.log("\nImporting statement...\n");
  const summary = await importStatement(userId, content, "indian-bank-statement.csv");

  console.log("=== Import Summary ===");
  console.log(JSON.stringify(summary, null, 2));

  console.log("\n=== Entities ===");
  const entities = await query<{ ID: string; NAME: string; IS_VERIFIED: boolean }>(
    `SELECT ID, NAME, IS_VERIFIED FROM LEDGERMIND.ENTITIES WHERE USER_ID = '${userId}' ORDER BY NAME`
  );
  for (const e of entities) {
    console.log(`  ${e.NAME}${e.IS_VERIFIED ? " (verified)" : " (unverified)"}`);
  }
  console.log(`\nTotal entities: ${entities.length}`);

  console.log("\n=== Financial Events ===");
  const events = await query<{ CNT: number; TOTAL: number }>(
    `SELECT COUNT(*) AS CNT, SUM(AMOUNT) AS TOTAL FROM LEDGERMIND.FINANCIAL_EVENTS WHERE USER_ID = '${userId}'`
  );
  console.log(events);

  process.exit(0);
}

main().catch((e) => {
  console.error("Import FAILED:", e);
  process.exit(1);
});