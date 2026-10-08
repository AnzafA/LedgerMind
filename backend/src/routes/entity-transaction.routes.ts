import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Get transactions for an entity
// Supports:
// ?view=combined
// ?view=by-account
router.get("/:entityId/transactions", async (req, res) => {
  try {
    const { entityId } = req.params;
    const view = (req.query.view as string) || "combined";

    if (view !== "combined" && view !== "by-account") {
      return res.status(400).json({
        success: false,
        message: "view must be either combined or by-account",
      });
    }

    // Find entity
    const entity = await prisma.entity.findUnique({
      where: {
        id: entityId,
      },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: "Entity not found",
      });
    }

    // Get financial events and their source records
    const events = await prisma.financialEvent.findMany({
      where: {
        entityId,
        status: "COMPLETED",
      },
      orderBy: {
        occurredAt: "desc",
      },
      include: {
        sourceRecords: {
          include: {
            account: true,
          },
        },
      },
    });

    // Combined view
    if (view === "combined") {
      const transactions = events.map((event) => ({
        financialEventId: event.id,
        amount: Number(event.amount),
        direction: event.direction,
        status: event.status,
        occurredAt: event.occurredAt,
        description: event.description,

        accounts: event.sourceRecords
          .filter((record) => record.account)
          .map((record) => ({
            accountId: record.account!.id,
            accountName: record.account!.name,
            bankName: record.account!.bankName,
            accountLast4: record.account!.accountLast4,
          })),
      }));

      return res.json({
        success: true,
        view: "combined",
        entity: {
          id: entity.id,
          name: entity.name,
        },
        transactions,
      });
    }

    // By-account view
    const accountGroups: Record<
      string,
      {
        accountId: string;
        accountName: string;
        bankName: string | null;
        accountLast4: string | null;
        transactions: {
          financialEventId: string;
          amount: number;
          direction: string;
          status: string;
          occurredAt: Date;
          description: string | null;
        }[];
      }
    > = {};

    for (const event of events) {
      for (const record of event.sourceRecords) {
        if (!record.account) {
          continue;
        }

        const account = record.account;

        if (!accountGroups[account.id]) {
          accountGroups[account.id] = {
            accountId: account.id,
            accountName: account.name,
            bankName: account.bankName,
            accountLast4: account.accountLast4,
            transactions: [],
          };
        }

        accountGroups[account.id].transactions.push({
          financialEventId: event.id,
          amount: Number(event.amount),
          direction: event.direction,
          status: event.status,
          occurredAt: event.occurredAt,
          description: event.description,
        });
      }
    }

    return res.json({
      success: true,
      view: "by-account",
      entity: {
        id: entity.id,
        name: entity.name,
      },
      accounts: Object.values(accountGroups),
    });
  } catch (error) {
    console.error("Get entity transactions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch entity transactions",
    });
  }
});

export default router;