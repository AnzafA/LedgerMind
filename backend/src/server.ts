import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./config/prisma";
import userRoutes from "./routes/user.routes";
import accountRoutes from "./routes/account.routes";
import financialEventRoutes from "./routes/financial-event.routes";
import transactionRecordRoutes from "./routes/transaction-record.routes";
import entityRoutes from "./routes/entity.routes";
import entityMatchRoutes from "./routes/entity-match.routes";
import searchRoutes from "./routes/search.routes";
import entityTransactionRoutes from "./routes/entity-transaction.routes"; 
import entityDecisionRoutes from "./routes/entity-decision.routes";      

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/financial-events", financialEventRoutes);
app.use("/api/transaction-records", transactionRecordRoutes);
app.use("/api/entities", entityRoutes);
app.use("/api/entity-matches", entityMatchRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/entities", entityTransactionRoutes);
app.use("/api/entity-decisions", entityDecisionRoutes);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "LedgerMind API and database are running",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`LedgerMind API running on port ${PORT}`);
});