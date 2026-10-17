import { Router } from "express";
import { query } from "../db/exasol.ts";

const router = Router();
const DEMO_EMAIL = "demo@ledgermind.dev";

router.get("/", async (_req, res) => {
  try {
    const users = await query<{ ID: string }>(
      `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
    );
    if (users.length === 0) return res.json({ success: true, accounts: [] });

    const accounts = await query(
      `SELECT ID, NAME, BANK_NAME, ACCOUNT_LAST4, ACCOUNT_TYPE
       FROM LEDGERMIND.ACCOUNTS
       WHERE USER_ID = '${users[0].ID}'
       ORDER BY CREATED_AT ASC`
    );

    res.json({ success: true, accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message });
  }
});

export default router;