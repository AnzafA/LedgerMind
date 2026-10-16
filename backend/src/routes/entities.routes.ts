import { Router } from "express";
import { query, execute, now } from "../db/exasol.ts";

const router = Router();

const DEMO_EMAIL = "demo@ledgermind.dev";

async function getDemoUserId(): Promise<string | null> {
  const rows = await query<{ ID: string }>(
    `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
  );
  return rows.length > 0 ? rows[0].ID : null;
}

router.get("/", async (_req, res) => {
  try {
    const userId = await getDemoUserId();
    if (!userId) return res.json({ success: true, entities: [] });

    const entities = await query(
      `SELECT e.ID, e.NAME, e.IS_VERIFIED,
              COALESCE(SUM(CASE WHEN f.DIRECTION = 'DEBIT' THEN f.AMOUNT ELSE 0 END), 0) AS SENT,
              COALESCE(SUM(CASE WHEN f.DIRECTION = 'CREDIT' THEN f.AMOUNT ELSE 0 END), 0) AS RECEIVED,
              COUNT(f.ID) AS TX_COUNT,
              MAX(f.OCCURRED_AT) AS LAST_TX
       FROM LEDGERMIND.ENTITIES e
       LEFT JOIN LEDGERMIND.FINANCIAL_EVENTS f ON f.ENTITY_ID = e.ID
       WHERE e.USER_ID = '${userId}'
       GROUP BY e.ID, e.NAME, e.IS_VERIFIED
       ORDER BY (SUM(CASE WHEN f.DIRECTION = 'DEBIT' THEN f.AMOUNT ELSE 0 END) +
                 SUM(CASE WHEN f.DIRECTION = 'CREDIT' THEN f.AMOUNT ELSE 0 END)) DESC`
    );

    res.json({ success: true, entities });
  } catch (error: any) {
    console.error("Entity list failed:", error);
    res.status(500).json({ success: false, message: error?.message });
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
      `SELECT ID, AMOUNT, DIRECTION, OCCURRED_AT, DESCRIPTION
       FROM LEDGERMIND.FINANCIAL_EVENTS
       WHERE ENTITY_ID = '${req.params.id}'
       ORDER BY OCCURRED_AT DESC`
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
    res.status(500).json({ success: false, message: error?.message });
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

export default router;