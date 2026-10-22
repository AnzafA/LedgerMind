import { Router } from "express";
import { query, execute, newId, now } from "../db/exasol.ts";

const router = Router();
const DEMO_EMAIL = "demo@ledgermind.dev";

let cachedUserId: string | null = null;
async function getDemoUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  const rows = await query<{ ID: string }>(
    `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
  );
  if (rows.length > 0) {
    cachedUserId = rows[0].ID;
    return cachedUserId;
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const userId = await getDemoUserId();
    if (!userId) return res.json({ success: true, entities: [] });

    const accountId = req.query.accountId as string | undefined;
    const importId = req.query.importId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    let filters = `WHERE e.USER_ID = '${userId}'`;
    
    if (accountId) {
      filters += ` AND f.ID IN (SELECT FINANCIAL_EVENT_ID FROM LEDGERMIND.TRANSACTION_RECORDS WHERE ACCOUNT_ID = '${accountId}')`;
    }
    if (importId) {
      filters += ` AND f.IMPORT_ID = '${importId}'`;
    }
    if (startDate && endDate) {
      filters += ` AND f.OCCURRED_AT >= '${startDate}' AND f.OCCURRED_AT <= '${endDate}'`;
    }

    const entities = await query<any>(
      `SELECT 
          e.ID, 
          e.NAME, 
          e.IS_VERIFIED,
          COALESCE(SUM(CASE WHEN f.DIRECTION = 'DEBIT' THEN f.AMOUNT ELSE 0 END), 0) AS SENT,
          COALESCE(SUM(CASE WHEN f.DIRECTION = 'CREDIT' THEN f.AMOUNT ELSE 0 END), 0) AS RECEIVED,
          COUNT(DISTINCT f.ID) AS TX_COUNT,
          MAX(f.OCCURRED_AT) AS LAST_TX
       FROM LEDGERMIND.ENTITIES e
       JOIN LEDGERMIND.FINANCIAL_EVENTS f ON f.ENTITY_ID = e.ID
       ${filters}
       GROUP BY e.ID, e.NAME, e.IS_VERIFIED
       ORDER BY SENT DESC`
    );

    const identifiers = await query<any>(
      `SELECT ENTITY_ID, IDENTIFIER_VALUE FROM LEDGERMIND.ENTITY_IDENTIFIERS`
    );

    const idMap = new Map<string, string[]>();
    for (const row of identifiers) {
      if (!idMap.has(row.ENTITY_ID)) idMap.set(row.ENTITY_ID, []);
      idMap.get(row.ENTITY_ID)!.push(row.IDENTIFIER_VALUE);
    }

    for (const e of entities) {
      const ids = idMap.get(e.ID);
      e.IDENTIFIERS = ids ? ids.join(", ") : null;
    }

    res.json({ success: true, entities });
  } catch (error: any) {
    console.error("Entity list failed:", error);
    res.status(500).json({ success: false, message: error?.message || String(error) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const userId = await getDemoUserId();
    if (!userId) return res.status(404).json({ success: false, message: "No user" });

    const entityRows = await query<{ ID: string; NAME: string; IS_VERIFIED: boolean }>(
      `SELECT ID, NAME, IS_VERIFIED FROM LEDGERMIND.ENTITIES WHERE ID = '${req.params.id}' AND USER_ID = '${userId}'`
    );
    if (entityRows.length === 0) {
      return res.status(404).json({ success: false, message: "Entity not found" });
    }

    const totals = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN DIRECTION = 'DEBIT' THEN AMOUNT ELSE 0 END), 0) AS SENT,
         COALESCE(SUM(CASE WHEN DIRECTION = 'CREDIT' THEN AMOUNT ELSE 0 END), 0) AS RECEIVED,
         COUNT(*) AS TX_COUNT
       FROM LEDGERMIND.FINANCIAL_EVENTS
       WHERE ENTITY_ID = '${req.params.id}'`
    );

        const transactions = await query(
      `SELECT 
         f.ID, 
         f.AMOUNT, 
         f.DIRECTION, 
         f.OCCURRED_AT, 
         f.DESCRIPTION,
         a.NAME AS ACCOUNT_NAME,
         a.ACCOUNT_LAST4
       FROM LEDGERMIND.FINANCIAL_EVENTS f
       LEFT JOIN LEDGERMIND.TRANSACTION_RECORDS r ON r.FINANCIAL_EVENT_ID = f.ID
       LEFT JOIN LEDGERMIND.ACCOUNTS a ON a.ID = r.ACCOUNT_ID
       WHERE f.ENTITY_ID = '${req.params.id}'
       ORDER BY f.OCCURRED_AT DESC`
    );

    const identifiers = await query(
      `SELECT IDENTIFIER_TYPE, IDENTIFIER_VALUE FROM LEDGERMIND.ENTITY_IDENTIFIERS WHERE ENTITY_ID = '${req.params.id}'`
    );

    res.json({
      success: true,
      entity: entityRows[0],
      totals: (totals as any)[0],
      transactions,
      identifiers,
    });
  } catch (error: any) {
    console.error("Entity detail failed:", error);
    res.status(500).json({ success: false, message: error?.message || String(error) });
  }
});

router.post("/:id/verify", async (req, res) => {
  try {
    await execute(
      `UPDATE LEDGERMIND.ENTITIES SET IS_VERIFIED = TRUE, UPDATED_AT = '${now()}' WHERE ID = '${req.params.id}'`
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message });
  }
});

router.post("/:id/rename", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Name required" });
    
    const safeName = name.replace(/'/g, "''");
    
    await execute(
      `UPDATE LEDGERMIND.ENTITIES SET NAME = '${safeName}', UPDATED_AT = '${now()}' WHERE ID = '${req.params.id}'`
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message });
  }
});

router.post("/:id/merge", async (req, res) => {
  try {
    const sourceId = req.params.id;
    const { targetId } = req.body;
    
    if (!targetId || sourceId === targetId) {
      return res.status(400).json({ success: false, message: "Invalid target ID" });
    }

    const userId = await getDemoUserId();
    if (!userId) return res.status(404).json({ success: false, message: "No user" });

    await execute(`UPDATE LEDGERMIND.FINANCIAL_EVENTS SET ENTITY_ID = '${targetId}' WHERE ENTITY_ID = '${sourceId}'`);
    await execute(`UPDATE LEDGERMIND.ENTITY_IDENTIFIERS SET ENTITY_ID = '${targetId}' WHERE ENTITY_ID = '${sourceId}'`);
    await execute(`UPDATE LEDGERMIND.ENTITY_ALIASES SET ENTITY_ID = '${targetId}' WHERE ENTITY_ID = '${sourceId}'`);

    const decisionId = newId();
    const t = now();
    await execute(
      `INSERT INTO LEDGERMIND.ENTITY_MATCH_DECISIONS (ID, USER_ID, ENTITY_ID, ALIAS, DECISION, CREATED_AT, UPDATED_AT) VALUES ('${decisionId}', '${userId}', '${targetId}', 'MERGE_FROM_${sourceId}', 'SAME', '${t}', '${t}')`
    );

    await execute(`DELETE FROM LEDGERMIND.ENTITIES WHERE ID = '${sourceId}'`);

    res.json({ success: true, mergedInto: targetId });
  } catch (error: any) {
    console.error("Merge failed:", error);
    res.status(500).json({ success: false, message: error?.message });
  }
});

export default router;