import { detectParser } from "../parsers/index.ts";
import { reconcile } from "../parsers/reconcile.ts";
import { extractNarration } from "../parsers/common/narration.ts";
import { query, execute, newId, now } from "../db/exasol.ts";
import { ParseResult } from "../parsers/types.ts";

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

// ============================================================================
// 1. CORE IMPORT FUNCTION (Accepts parsed JSON from either CSV or PDF)
// ============================================================================
export async function importParsedData(
  userId: string,
  parsed: ParseResult,
  fileName: string
): Promise<ImportSummary> {
  // 1. Reconcile — hard fail if it doesn't match
  const rec = reconcile(parsed);
  if (!rec.ok) {
    throw new Error("Reconciliation failed: " + rec.message);
  }
  
  const importId = newId(); // Declared ONCE here at the top

  // 2. Find or create Account
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
    const rawType = (parsed.accountInfo.accountType || "Savings").toUpperCase();
    const accountType = rawType.includes("CURRENT") ? "CURRENT"
      : rawType.includes("OD") || rawType.includes("OVERDRAFT") ? "OD_CC"
      : rawType.includes("LOAN") ? "OTHER"
      : "SAVINGS";
      
    const safeType = (parsed.accountInfo.accountType || "Savings").replace(/'/g, "''");
    const safeBranch = (parsed.accountInfo.branchName || "").replace(/'/g, "''");
    
    // Corrected the SQL here back to ACCOUNTS
        const safeBankName = (parsed.accountInfo.bankName || "Unknown Bank").replace(/'/g, "''");
    
    await execute(
      `INSERT INTO LEDGERMIND.ACCOUNTS (ID, USER_ID, NAME, BANK_NAME, ACCOUNT_LAST4, ACCOUNT_TYPE, IFSC, BRANCH, CURRENCY, IS_PRIMARY, CREATED_AT, UPDATED_AT) VALUES ('${accountId}', '${userId}', '${safeType}', '${safeBankName}', '${last4}', '${accountType}', '${parsed.accountInfo.ifsc || ""}', '${safeBranch}', 'INR', TRUE, '${t}', '${t}')`
    );

    accountCreated = true;
  }

  // 3. Preload existing identifiers, names, and aliases into a lookup map
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

  const existingEntities = await query<{ ID: string; NAME: string }>(
    `SELECT ID, NAME FROM LEDGERMIND.ENTITIES WHERE USER_ID = '${userId}'`
  );
  for (const row of existingEntities) {
    entityByKey.set(`NAME:${row.NAME.toUpperCase()}`, row.ID);
  }

  const existingAliases = await query<{ ENTITY_ID: string; ALIAS: string }>(
    `SELECT ENTITY_ID, ALIAS FROM LEDGERMIND.ENTITY_ALIASES WHERE ENTITY_ID IN (SELECT ID FROM LEDGERMIND.ENTITIES WHERE USER_ID = '${userId}')`
  );
  for (const row of existingAliases) {
    entityByKey.set(`NAME:${row.ALIAS.toUpperCase()}`, row.ENTITY_ID);
  }

  // 4. Process transactions
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

    // Create FinancialEvent (skip if already exists)
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
      // If it exists, just update the IMPORT_ID so it shows up in the new filtered view
      await execute(
        `UPDATE LEDGERMIND.FINANCIAL_EVENTS SET IMPORT_ID = '${importId}' WHERE ID = '${existing[0].ID}'`
      );
      importedCount++;
      continue;
    }

    const eventId = newId();
    const t = now();
    
    // Added IMPORT_ID to the INSERT statement
    await execute(
      `INSERT INTO LEDGERMIND.FINANCIAL_EVENTS (ID, USER_ID, ENTITY_ID, IMPORT_ID, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, DESCRIPTION, CREATED_AT, UPDATED_AT) VALUES ('${eventId}', '${userId}', ${entityIdSql}, '${importId}', ${tx.amount}, '${tx.direction}', 'COMPLETED', '${occ}', '${safeDesc}', '${t}', '${t}')`
    );

    // Create TransactionRecord
    const recId = newId();
    await execute(
      `INSERT INTO LEDGERMIND.TRANSACTION_RECORDS (ID, FINANCIAL_EVENT_ID, ACCOUNT_ID, SOURCE_TYPE, SOURCE_REFERENCE, RAW_DESCRIPTION, AMOUNT, DIRECTION, TX_STATUS, OCCURRED_AT, CREATED_AT) VALUES ('${recId}', '${eventId}', '${accountId}', 'BANK_STATEMENT', NULL, '${safeDesc}', ${tx.amount}, '${tx.direction}', 'COMPLETED', '${occ}', '${t}')`
    );

    importedCount++;
  }

  // 5. Log StatementImport
  const t = now();
  const safeFileName = fileName.replace(/'/g, "''");
  const fileHash = newId();
  
  await execute(
    `INSERT INTO LEDGERMIND.STATEMENT_IMPORTS (ID, USER_ID, ACCOUNT_ID, SOURCE_TYPE, FILE_NAME, FILE_HASH, PARSED_COUNT, IMPORTED_COUNT, SKIPPED_COUNT, IMPORT_STATUS, STARTED_AT, COMPLETED_AT) VALUES ('${importId}', '${userId}', '${accountId}', 'BANK_STATEMENT', '${safeFileName}', '${fileHash}', ${parsed.transactions.length}, ${importedCount}, ${skippedSelfTransfers + skippedBankCharges}, 'COMPLETED', '${t}', '${t}')`
  );

  return {
    importId,
    parserId: parsed.parserId,
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

// ============================================================================
// 2. CSV WRAPPER (Handles the detection and routing for CSV files)
// ============================================================================
export async function importStatement(
  userId: string,
  csvContent: string,
  fileName: string
): Promise<ImportSummary> {
  const parser = detectParser(csvContent, fileName);
  if (!parser) {
    throw new Error("No parser recognized this CSV file format.");
  }

  const parsed = parser.parse(csvContent);
  return importParsedData(userId, parsed, fileName);
}