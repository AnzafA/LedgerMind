import { Router } from "express";
import { query } from "../db/exasol.ts";

const router = Router();
const DEMO_EMAIL = "demo@ledgermind.dev";

router.get("/", async (req, res) => {
  try {
    const users = await query<{ ID: string }>(
      `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
    );
    if (users.length === 0) return res.json({ success: true, transactions: [] });
    const userId = users[0].ID;

    const accountId = req.query.accountId as string | undefined;
    const accountFilter = accountId ? `AND a.ID = '${accountId}'` : "";

    const transactions = await query(
      `SELECT 
         f.ID, 
         f.AMOUNT, 
         f.DIRECTION, 
         f.OCCURRED_AT, 
         f.DESCRIPTION,
         e.NAME AS ENTITY_NAME,
         a.NAME AS ACCOUNT_NAME,
         a.ACCOUNT_LAST4
       FROM LEDGERMIND.FINANCIAL_EVENTS f
       LEFT JOIN LEDGERMIND.TRANSACTION_RECORDS r ON r.FINANCIAL_EVENT_ID = f.ID
       LEFT JOIN LEDGERMIND.ACCOUNTS a ON a.ID = r.ACCOUNT_ID
       LEFT JOIN LEDGERMIND.ENTITIES e ON e.ID = f.ENTITY_ID
       WHERE f.USER_ID = '${userId}' ${accountFilter}
       ORDER BY f.OCCURRED_AT DESC`
    );

    res.json({ success: true, transactions });
  } catch (error: any) {
    console.error("Transaction list failed:", error);
    res.status(500).json({ success: false, message: error?.message });
  }
});

export default router;