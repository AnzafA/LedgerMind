import { Router, Request, Response } from "express";
import multer from "multer";
import { importStatement, importParsedData } from "../services/import-statement.ts";
import { parsePdfStatement } from "../parsers/indian-bank/pdf-parser.ts";
import { parseUniversalPdf } from "../parsers/universal-pdf.ts";
import { query, execute, newId, now } from "../db/exasol.ts";
import { FormatNotRecognizedError } from "../parsers/types.ts";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const DEMO_EMAIL = "demo@ledgermind.dev";

async function getOrCreateDemoUser(): Promise<string> {
  const rows = await query<{ ID: string }>(`SELECT ID FROM LEDGERMIND.USERS WHERE EMAIL = '${DEMO_EMAIL}'`);
  if (rows.length > 0) return rows[0].ID;
  const id = newId();
  const t = now();
  await execute(`INSERT INTO LEDGERMIND.USERS (ID, EMAIL, NAME, CREATED_AT, UPDATED_AT) VALUES ('${id}', '${DEMO_EMAIL}', 'Demo User', '${t}', '${t}')`);
  return id;
}

router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const userId = await getOrCreateDemoUser();
    const fileName = file.originalname;
    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const fileBuffer = file.buffer;

    let summary;

        if (isPdf) {
      console.log(`PDF detected (${fileName}). Routing...`);
      let parsed;
      try {
        parsed = await parsePdfStatement(fileBuffer);
      } catch (e: any) {
        // Only fallback if it's a format error. Rethrow real math/validation errors.
        if (e instanceof FormatNotRecognizedError || e.message?.includes("Could not recognize")) {
          console.log("Format unrecognized. Falling back to Universal PDF Parser...");
          parsed = await parseUniversalPdf(fileBuffer);
        } else {
          throw e; 
        }
      }
      summary = await importParsedData(userId, parsed, fileName);
    } else {
      console.log(`CSV detected (${fileName}). Routing...`);
      const csvContent = fileBuffer.toString("utf-8");
      // Uses the registry (index.ts) to find the right CSV parser
      summary = await importStatement(userId, csvContent, fileName);
    }

    res.json({ success: true, summary });
  } catch (error: any) {
    console.error("Import failed:", error);
    res.status(500).json({ success: false, message: error?.message || "Import failed" });
  }
});

export default router;