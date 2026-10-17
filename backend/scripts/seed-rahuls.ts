import "dotenv/config";
import { query, execute, newId, now } from "../src/db/exasol.ts";

const DEMO_EMAIL = "demo@ledgermind.dev";

async function main() {
  const users = await query<{ ID: string }>(
    `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
  );
  if (users.length === 0) {
    console.error("Demo user not found. Import a statement first.");
    process.exit(1);
  }
  const userId = users[0].ID;

  // Get the existing account so we can attach transactions to it
  const accounts = await query<{ ID: string }>(
    `SELECT ID FROM LEDGERMIND.ACCOUNTS WHERE USER_ID = '${userId}' LIMIT 1`
  );
  if (accounts.length === 0) {
    console.error("No account found. Import a statement first.");
    process.exit(1);
  }
  const accountId = accounts[0].ID;

  const rahulA = newId();
  const rahulB = newId();
  const t = now();

  // 1. Create the two entities
  await execute(
    `INSERT INTO LEDGERMIND.ENTITIES (ID, USER_ID, NAME, ENTITY_TYPE, IS_VERIFIED, CREATED_AT, UPDATED_AT) VALUES ('${rahulA}', '${userId}', 'Rahul Kumar', 'PERSON', FALSE, '${t}', '${t}')`
  );
  await execute(
    `INSERT INTO LEDGERMIND.ENTITIES (ID, USER_ID, NAME, ENTITY_TYPE, IS_VERIFIED, CREATED_AT, UPDATED_AT) VALUES ('${rahulB}', '${userId}', 'Rahul Kumar', 'PERSON', FALSE, '${t}', '${t}')`
  );

  // 2. Add distinct UPI identifiers to each
  await execute(
    `INSERT INTO LEDGERMIND.ENTITY_IDENTIFIERS (ID, ENTITY_ID, IDENTIFIER_TYPE, IDENTIFIER_VALUE, RAW_VALUE, CREATED_AT) VALUES ('${newId()}', '${rahulA}', 'UPI', 'rahul.k@ybl', 'rahul.k@ybl', '${t}')`
  );
  await execute(
    `INSERT INTO LEDGERMIND.ENTITY_IDENTIFIERS (ID, ENTITY_ID, IDENTIFIER_TYPE, IDENTIFIER_VALUE, RAW_VALUE, CREATED_AT) VALUES ('${newId()}', '${rahulB}', 'UPI', 'rahul.kumar@okhdfcbank', 'rahul.kumar@okhdfcbank', '${t}')`
  );

  // 3. Create fake transactions for each so they show up in the list
  const eventA = newId();
  const eventB = newId();
  const occ = "2026-10-01 10:00:00";

  // Rahul A Transaction (₹15,000)
  await execute(
    `INSERT INTO LEDGERMIND.FINANCIAL_EVENTS (ID, USER_ID, ENTITY_ID, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, DESCRIPTION, CREATED_AT, UPDATED_AT) VALUES ('${eventA}', '${userId}', '${rahulA}', 15000, 'DEBIT', 'COMPLETED', '${occ}', 'UPI/RAHUL K/PAYMENT', '${t}', '${t}')`
  );
  await execute(
    `INSERT INTO LEDGERMIND.TRANSACTION_RECORDS (ID, FINANCIAL_EVENT_ID, ACCOUNT_ID, SOURCE_TYPE, SOURCE_REFERENCE, RAW_DESCRIPTION, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, CREATED_AT) VALUES ('${newId()}', '${eventA}', '${accountId}', 'BANK_STATEMENT', NULL, 'UPI/RAHUL K/PAYMENT', 15000, 'DEBIT', 'COMPLETED', '${occ}', '${t}')`
  );

  // Rahul B Transaction (₹45,000)
  await execute(
    `INSERT INTO LEDGERMIND.FINANCIAL_EVENTS (ID, USER_ID, ENTITY_ID, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, DESCRIPTION, CREATED_AT, UPDATED_AT) VALUES ('${eventB}', '${userId}', '${rahulB}', 45000, 'DEBIT', 'COMPLETED', '${occ}', 'UPI/RAHUL KUMAR/PAYMENT', '${t}', '${t}')`
  );
  await execute(
    `INSERT INTO LEDGERMIND.TRANSACTION_RECORDS (ID, FINANCIAL_EVENT_ID, ACCOUNT_ID, SOURCE_TYPE, SOURCE_REFERENCE, RAW_DESCRIPTION, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, CREATED_AT) VALUES ('${newId()}', '${eventB}', '${accountId}', 'BANK_STATEMENT', NULL, 'UPI/RAHUL KUMAR/PAYMENT', 45000, 'DEBIT', 'COMPLETED', '${occ}', '${t}')`
  );

  console.log("✓ Seeded two Rahul Kumars with transactions:");
  console.log("  A: ₹15,000 → rahul.k@ybl");
  console.log("  B: ₹45,000 → rahul.kumar@okhdfcbank");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});