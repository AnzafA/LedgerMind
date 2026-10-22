import "dotenv/config";
import { execute } from "../src/db/exasol.ts";

async function main() {
  console.log("Forcing all transactions to IS_VALIDATED = TRUE...");
  await execute("UPDATE LEDGERMIND.FINANCIAL_EVENTS SET IS_VALIDATED = TRUE");
  console.log("Done! Refresh your browser.");
  process.exit(0);
}

main().catch(console.error);