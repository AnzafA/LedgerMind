import { Router } from "express";
import { query } from "../db/exasol.ts";

const router = Router();
const DEMO_EMAIL = "demo@ledgermind.dev";

router.get("/monthly", async (_req, res) => {
  try {
    const users = await query<{ ID: string }>(
      `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
    );
    if (users.length === 0) return res.json({ success: true, data: [] });
    const userId = users[0].ID;

    // FIXED: Use EXTRACT directly in the GROUP BY clause
    const data = await query(
      `SELECT 
         EXTRACT(YEAR FROM f.OCCURRED_AT) AS Y,
         EXTRACT(MONTH FROM f.OCCURRED_AT) AS M,
         COALESCE(SUM(CASE WHEN f.DIRECTION = 'DEBIT' THEN f.AMOUNT ELSE 0 END), 0) AS SENT,
         COALESCE(SUM(CASE WHEN f.DIRECTION = 'CREDIT' THEN f.AMOUNT ELSE 0 END), 0) AS RECEIVED
       FROM LEDGERMIND.FINANCIAL_EVENTS f
       WHERE f.USER_ID = '${userId}'
       GROUP BY EXTRACT(YEAR FROM f.OCCURRED_AT), EXTRACT(MONTH FROM f.OCCURRED_AT)
       ORDER BY Y ASC, M ASC`
    );

    // Format the string labels in JavaScript to avoid Exasol date formatting issues
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const parsedData = (data as any[]).map(row => ({
      month: `${months[Number(row.M) - 1]} ${row.Y}`,
      sent: Number(row.SENT),
      received: Number(row.RECEIVED)
    }));

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("Analytics failed:", error);
    res.status(500).json({ success: false, message: error?.message });
  }
});

export default router;