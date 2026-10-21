import { Router, Request, Response } from "express";
import multer from "multer";
import { importStatement, importParsedData } from "../services/import-statement.ts";
import { parsePdfStatement } from "../parsers/indian-bank/pdf-parser.ts";
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

router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    // 1. Safe check for the uploaded file
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const userId = await getOrCreateDemoUser();
    const fileName = file.originalname;
    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const fileBuffer = file.buffer;

    let summary;

    // 2. Route to the correct parser based on file extension
    if (isPdf) {
      console.log(`PDF detected (${fileName}). Parsing directly to JSON...`);
      const parsed = await parsePdfStatement(fileBuffer);
      summary = await importParsedData(userId, parsed, fileName);
      console.log(`PDF import successful. Reconciled: ${summary.reconciles}`);
    } else {
      console.log(`CSV detected (${fileName}). Parsing as text...`);
      const csvContent = fileBuffer.toString("utf-8");
      summary = await importStatement(userId, csvContent, fileName);
      console.log(`CSV import successful. Reconciled: ${summary.reconciles}`);
    }

    // 3. Return the summary to the frontend
    res.json({ success: true, summary });
  } catch (error: any) {
    console.error("Import failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Import failed during processing",
    });
  }
});

export default router;  