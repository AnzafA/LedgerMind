import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Create a transaction record
router.post("/", async (req, res) => {
  try {
    const {
      financialEventId,
      accountId,
      sourceType,
      sourceReference,
      rawDescription,
      amount,
      direction,
      status,
      occurredAt,
    } = req.body;

    if (
      !financialEventId ||
      amount === undefined ||
      !direction ||
      !status ||
      !occurredAt ||
      !sourceType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "financialEventId, amount, direction, status, occurredAt and sourceType are required",
      });
    }

    // Check the financial event exists
    const financialEvent = await prisma.financialEvent.findUnique({
      where: {
        id: financialEventId,
      },
    });

    if (!financialEvent) {
      return res.status(404).json({
        success: false,
        message: "Financial event not found",
      });
    }

    // If accountId is provided, verify the account belongs
    // to the same user as the financial event
    if (accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
          userId: financialEvent.userId,
        },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found for this financial event",
        });
      }
    }

    const record = await prisma.transactionRecord.create({
      data: {
        financialEventId,
        accountId: accountId || null,
        sourceType,
        sourceReference: sourceReference || null,
        rawDescription: rawDescription || null,
        amount,
        direction,
        status,
        occurredAt: new Date(occurredAt),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Transaction record created successfully",
      data: record,
    });
  } catch (error) {
    console.error("Create transaction record error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create transaction record",
    });
  }
});

// Get all records belonging to a financial event
router.get("/event/:financialEventId", async (req, res) => {
  try {
    const { financialEventId } = req.params;

    const records = await prisma.transactionRecord.findMany({
      where: {
        financialEventId,
      },
      include: {
        account: true,
        financialEvent: true,
      },
      orderBy: {
        occurredAt: "desc",
      },
    });

    return res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Get transaction records error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction records",
    });
  }
});

export default router;