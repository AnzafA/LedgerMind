import "dotenv/config";
import { query, execute, newId, now } from "../src/db/exasol.ts";

async function main() {
  const userId = newId();
  const t = now();

  await execute(
    `INSERT INTO LEDGERMIND.USERS (ID, EMAIL, NAME, CREATED_AT, UPDATED_AT) VALUES ('${userId}', 'test@example.com', 'Test User', '${t}', '${t}')`
  );
  console.log("Inserted user:", userId);

  const users = await query<{ ID: string; EMAIL: string; NAME: string }>(
    `SELECT ID, EMAIL, NAME FROM LEDGERMIND.USERS WHERE ID = '${userId}'`
  );
  console.log("Read back:", users);

  await execute(`DELETE FROM LEDGERMIND.USERS WHERE ID = '${userId}'`);
  console.log("Cleaned up");

  process.exit(0);
}

main().catch((e) => {
  console.error("Client test FAILED:", e);
  process.exit(1);
});
