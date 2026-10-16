import { detectParser } from "../parsers/index.ts";
import { reconcile } from "../parsers/reconcile.ts";
import { extractNarration } from "../parsers/common/narration.ts";
import { query, execute, newId, now } from "../db/exasol.ts";

export interface ImportSummary {
  importId: string;
  parserId: string;
  accountId: string;
  accountCreated: boolean;
  totalTransactions: number;
  importedCount: number;
  skippedSelfTransfers: number;
  skippedBankCharges: number;
  entitiesCreated: number;
  entitiesMatched: number;
  reconciles: boolean;
  openingBalance?: number;
  closingBalance?: number;
}

export async function importStatement(
  userId: string,
  csvContent: string,
  fileName: string
): Promise<ImportSummary> {
  const parser = detectParser(csvContent, fileName);
  if (!parser) {
    throw new Error("No parser recognized this file format.");
  }

  const parsed = parser.parse(csvContent);

  const rec = reconcile(parsed);
  if (!rec.ok) {
    throw new Error("Reconciliation failed: " + rec.message);
  }

  // Find or create Account
  let accountId: string;
  let accountCreated = false;
  const last4 = (parsed.accountInfo.accountNumber || "0000").slice(-4);
  const existingAccounts = await query<{ ID: string }>(
    `SELECT ID FROM LEDGERMIND.ACCOUNTS WHERE USER_ID = '${userId}' AND ACCOUNT_LAST4 = '${last4}'`
  );

  if (existingAccounts.length > 0) {
    accountId = existingAccounts[0].ID;
  } else {
    accountId = newId();
    const t = now();
    const safeType = (parsed.accountInfo.accountType || "Savings").replace(/'/g, "''");
    const safeBranch = (parsed.accountInfo.branchName || "").replace(/'/g, "''");
    await execute(
      `INSERT INTO LEDGERMIND.ACCOUNTS (ID, USER_ID, NAME, BANK_NAME, ACCOUNT_LAST4, ACCOUNT_TYPE, IFSC, BRANCH, CURRENCY, IS_PRIMARY, CREATED_AT, UPDATED_AT) VALUES ('${accountId}', '${userId}', '${safeType}', 'Indian Bank', '${last4}', 'SAVINGS', '${parsed.accountInfo.ifsc || ""}', '${safeBranch}', 'INR', TRUE, '${t}', '${t}')`
    );
    accountCreated = true;
  }

  // Preload existing identifiers into a lookup map
    // Preload existing identifiers AND entity names into a lookup map
  const entityByKey = new Map<string, string>();
  const existingIdentifiers = await query<{
    ENTITY_ID: string;
    IDENTIFIER_TYPE: string;
    IDENTIFIER_VALUE: string;
  }>(
    `SELECT ENTITY_ID, IDENTIFIER_TYPE, IDENTIFIER_VALUE FROM LEDGERMIND.ENTITY_IDENTIFIERS WHERE ENTITY_ID IN (SELECT ID FROM LEDGERMIND.ENTITIES WHERE USER_ID = '${userId}')`
  );
  for (const row of existingIdentifiers) {
    entityByKey.set(`${row.IDENTIFIER_TYPE}:${row.IDENTIFIER_VALUE}`, row.ENTITY_ID);
  }

  // Also load entity names so name-only entities match on re-import
  const existingEntities = await query<{ ID: string; NAME: string }>(
    `SELECT ID, NAME FROM LEDGERMIND.ENTITIES WHERE USER_ID = '${userId}'`
  );
  for (const row of existingEntities) {
    entityByKey.set(`NAME:${row.NAME.toUpperCase()}`, row.ID);
  }

  let importedCount = 0;
  let skippedSelfTransfers = 0;
  let skippedBankCharges = 0;
  let entitiesCreated = 0;
  let entitiesMatched = 0;

  const holder = parsed.accountInfo.holderName;

  for (const tx of parsed.transactions) {
    const n = extractNarration(tx.description, holder);

    if (n.isSelfTransfer) { skippedSelfTransfers++; continue; }
    if (n.isBankCharge) { skippedBankCharges++; continue; }

    // Resolve entity
    let entityId: string | null = null;
    const lookupKeys: string[] = [];
    if (n.counterpartyAccount) lookupKeys.push(`ACCOUNT_NUMBER:${n.counterpartyAccount}`);
    if (n.counterpartyPhone) lookupKeys.push(`PHONE:${n.counterpartyPhone}`);
    if (n.counterpartyName) lookupKeys.push(`NAME:${n.counterpartyName.toUpperCase()}`);

    for (const key of lookupKeys) {
      const found = entityByKey.get(key);
      if (found) { entityId = found; entitiesMatched++; break; }
    }

    if (!entityId && n.counterpartyName) {
      entityId = newId();
      const t = now();
      const safeName = n.counterpartyName.replace(/'/g, "''");
      await execute(
        `INSERT INTO LEDGERMIND.ENTITIES (ID, USER_ID, NAME, ENTITY_TYPE, IS_VERIFIED, CREATED_AT, UPDATED_AT) VALUES ('${entityId}', '${userId}', '${safeName}', 'UNKNOWN', FALSE, '${t}', '${t}')`
      );

      if (n.counterpartyAccount) {
        const idId = newId();
        await execute(
          `INSERT INTO LEDGERMIND.ENTITY_IDENTIFIERS (ID, ENTITY_ID, IDENTIFIER_TYPE, IDENTIFIER_VALUE, RAW_VALUE, CREATED_AT) VALUES ('${idId}', '${entityId}', 'ACCOUNT_NUMBER', '${n.counterpartyAccount}', '${n.counterpartyAccount}', '${t}')`
        );
        entityByKey.set(`ACCOUNT_NUMBER:${n.counterpartyAccount}`, entityId);
      }
      if (n.counterpartyPhone) {
        const idId = newId();
        await execute(
          `INSERT INTO LEDGERMIND.ENTITY_IDENTIFIERS (ID, ENTITY_ID, IDENTIFIER_TYPE, IDENTIFIER_VALUE, RAW_VALUE, CREATED_AT) VALUES ('${idId}', '${entityId}', 'PHONE', '${n.counterpartyPhone}', '${n.counterpartyPhone}', '${t}')`
        );
        entityByKey.set(`PHONE:${n.counterpartyPhone}`, entityId);
      }
      entityByKey.set(`NAME:${n.counterpartyName.toUpperCase()}`, entityId);
      entitiesCreated++;
    }

    // Create FinancialEvent
    const safeDesc = tx.description.replace(/'/g, "''");
    const occ = tx.date.toISOString().replace("T", " ").slice(0, 19);
    const entityIdSql = entityId ? `'${entityId}'` : "NULL";

    const existing = await query<{ ID: string }>(
      `SELECT ID FROM LEDGERMIND.FINANCIAL_EVENTS
       WHERE USER_ID = '${userId}'
         AND AMOUNT = ${tx.amount}
         AND DIRECTION = '${tx.direction}'
         AND OCCURRED_AT = '${occ}'
         AND ${entityId ? `ENTITY_ID = '${entityId}'` : "ENTITY_ID IS NULL"}`
    );

    if (existing.length > 0) {
      importedCount++;
      continue;
    }

    const eventId = newId();
    const t = now();
    await execute(
            `INSERT INTO LEDGERMIND.FINANCIAL_EVENTS (ID, USER_ID, ENTITY_ID, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, DESCRIPTION, CREATED_AT, UPDATED_AT) VALUES ('${eventId}', '${userId}', ${entityIdSql}, ${tx.amount}, '${tx.direction}', 'COMPLETED', '${occ}', '${safeDesc}', '${t}', '${t}')`
    );

    // Create TransactionRecord
    const recId = newId();
    await execute(
      `INSERT INTO LEDGERMIND.TRANSACTION_RECORDS (ID, FINANCIAL_EVENT_ID, ACCOUNT_ID, SOURCE_TYPE, SOURCE_REFERENCE, RAW_DESCRIPTION, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, CREATED_AT) VALUES ('${recId}', '${eventId}', '${accountId}', 'BANK_STATEMENT', NULL, '${safeDesc}', ${tx.amount}, '${tx.direction}', 'COMPLETED', '${occ}', '${t}')`
    );

    importedCount++;
  }

  // Log StatementImport
  const importId = newId();
  const t = now();
  const safeFileName = fileName.replace(/'/g, "''");
  const fileHash = newId();
  await execute(
    `INSERT INTO LEDGERMIND.STATEMENT_IMPORTS (ID, USER_ID, ACCOUNT_ID, SOURCE_TYPE, FILE_NAME, FILE_HASH, PARSED_COUNT, IMPORTED_COUNT, SKIPPED_COUNT, IMPORT_STATUS, STARTED_AT, COMPLETED_AT) VALUES ('${importId}', '${userId}', '${accountId}', 'BANK_STATEMENT', '${safeFileName}', '${fileHash}', ${parsed.transactions.length}, ${importedCount}, ${skippedSelfTransfers + skippedBankCharges}, 'COMPLETED', '${t}', '${t}')`
  );

  return {
    importId,
    parserId: parser.id,
    accountId,
    accountCreated,
    totalTransactions: parsed.transactions.length,
    importedCount,
    skippedSelfTransfers,
    skippedBankCharges,
    entitiesCreated,
    entitiesMatched,
    reconciles: rec.ok,
    openingBalance: rec.openingBalance,
    closingBalance: rec.closingBalance,
  };
}