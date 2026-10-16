import "dotenv/config";
import { execute, query } from "../src/db/exasol.ts";

async function main() {
  try {
    await execute(
      "ALTER TABLE LEDGERMIND.ENTITIES ADD COLUMN IS_VERIFIED BOOLEAN DEFAULT FALSE"
    );
    console.log("IS_VERIFIED column added.");
  } catch (e: any) {
    if (String(e).includes("already exists") || String(e).includes("EXISTS")) {
      console.log("IS_VERIFIED column already exists. Skipping.");
    } else {
      throw e;
    }
  }

  const cols = await query<{ COLUMN_NAME: string }>(
    "SELECT COLUMN_NAME FROM SYS.EXA_ALL_COLUMNS WHERE COLUMN_SCHEMA = 'LEDGERMIND' AND COLUMN_TABLE = 'ENTITIES'"
  );
  console.log("ENTITIES columns:", cols.map((c) => c.COLUMN_NAME).join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});