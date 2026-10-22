import { Router } from "express";
import { query } from "../db/exasol.ts";

const router = Router();
const DEMO_EMAIL = "demo@ledgermind.dev";

router.get("/", async (_req, res) => {
  try {
    const users = await query<{ ID: string }>(
      `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
    );
    if (users.length === 0) return res.json({ success: true, imports: [] });
    const userId = users[0].ID;

    const imports = await query(
      `SELECT 
         ID, 
         FILE_NAME, 
         PARSED_COUNT, 
         IMPORTED_COUNT, 
         SKIPPED_COUNT, 
         IMPORT_STATUS, 
         STARTED_AT
       FROM LEDGERMIND.STATEMENT_IMPORTS
       WHERE USER_ID = '${userId}'
       ORDER BY STARTED_AT DESC`
    );

    res.json({ success: true, imports });
  } catch (error: any) {
    console.error("Import history failed:", error);
    res.status(500).json({ success: false, message: error?.message });
  }
});

export default router;