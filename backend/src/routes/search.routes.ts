import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Search entities and return financial summary
router.get("/", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const query = req.query.q as string;

    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        message: "userId and q are required",
      });
    }

    const searchTerm = query.trim();

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot be empty",
      });
    }

    // Search entity names and aliases
    const entities = await prisma.entity.findMany({
      where: {
        userId,
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
          {
            aliases: {
              some: {
                alias: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      include: {
        aliases: true,
        financialEvents: {
          orderBy: {
            occurredAt: "desc",
          },
        },
      },
    });

    const results = entities.map((entity) => {
      const completedEvents = entity.financialEvents.filter(
        (event) => event.status === "COMPLETED"
      );

      let totalPaid = 0;
      let totalReceived = 0;

      for (const event of completedEvents) {
        const amount = Number(event.amount);

        if (event.direction === "DEBIT") {
          totalPaid += amount;
        }

        if (event.direction === "CREDIT") {
          totalReceived += amount;
        }
      }

      const lastTransaction = completedEvents[0] || null;

      return {
        entityId: entity.id,
        name: entity.name,

        aliases: entity.aliases.map((alias) => alias.alias),

        transactionCount: completedEvents.length,

        totalPaid,
        totalReceived,

        lastTransaction: lastTransaction
          ? {
              amount: Number(lastTransaction.amount),
              direction: lastTransaction.direction,
              status: lastTransaction.status,
              occurredAt: lastTransaction.occurredAt,
              description: lastTransaction.description,
            }
          : null,
      };
    });

    return res.json({
      success: true,
      query: searchTerm,
      results,
    });
  } catch (error) {
    console.error("Entity search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search financial memory",
    });
  }
});

export default router;