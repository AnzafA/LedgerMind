import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { query } from "./db/exasol.ts";
import statementsRoutes from "./routes/statements.routes.ts";
import entitiesRoutes from "./routes/entities.routes.ts";
import accountsRoutes from "./routes/accounts.routes.ts";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
// Catch any unhandled errors and return JSON instead of HTML
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Global Server Error:", err);
  res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
});

app.use("/api/statements", statementsRoutes);
app.use("/api/entities", entitiesRoutes);
app.use("/api/accounts", accountsRoutes);

app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ success: true, message: "LedgerMind API and Exasol running" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`LedgerMind API running on port ${PORT}`);
});