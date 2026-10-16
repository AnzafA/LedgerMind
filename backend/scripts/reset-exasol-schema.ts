import "dotenv/config";
import { execute, query } from "../src/db/exasol.ts";

const TABLES = [
  "TRANSACTION_RECORDS",
  "FINANCIAL_EVENTS",
  "ENTITY_MATCH_DECISIONS",
  "ENTITY_IDENTIFIERS",
  "ENTITY_ALIASES",
  "ENTITIES",
  "STATEMENT_IMPORTS",
  "ACCOUNTS",
  "USERS",
];

async function main() {
  for (const t of TABLES) {
    try {
      await execute(`DROP TABLE IF EXISTS LEDGERMIND.${t} CASCADE`);
      console.log("Dropped:", t);
    } catch (e: any) {
      console.log("Skip", t, "-", String(e).slice(0, 100));
    }
  }

  const remaining = await query<{ TABLE_NAME: string }>(
    "SELECT TABLE_NAME FROM SYS.EXA_ALL_TABLES WHERE TABLE_SCHEMA = 'LEDGERMIND'"
  );
  console.log("\nRemaining tables:", remaining.length);
  for (const r of remaining) console.log("  -", r.TABLE_NAME);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});