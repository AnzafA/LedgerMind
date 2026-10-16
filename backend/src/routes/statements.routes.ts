import { Router } from "express";
import multer from "multer";
import { importStatement } from "../services/import-statement.ts";
import { query, execute, newId, now } from "../db/exasol.ts";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const DEMO_EMAIL = "demo@ledgermind.dev";

async function getOrCreateDemoUser(): Promise<string> {
  const rows = await query<{ ID: string }>(
    `SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`
  );
  if (rows.length > 0) return rows[0].ID;

  const id = newId();
  const t = now();
  await execute(
    `INSERT INTO LEDGERMIND.USERS (ID, EMAIL, NAME, CREATED_AT, UPDATED_AT) VALUES ('${id}', '${DEMO_EMAIL}', 'Demo User', '${t}', '${t}')`
  );
  return id;
}

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const userId = await getOrCreateDemoUser();
    const summary = await importStatement(userId, csvContent, req.file.originalname);

    res.json({ success: true, summary });
  } catch (error: any) {
    console.error("Import failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Import failed",
    });
  }
});

export default router;