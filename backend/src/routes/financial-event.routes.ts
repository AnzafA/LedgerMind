import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Create a financial event
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      entityId,
      amount,
      direction,
      status,
      occurredAt,
      description,
    } = req.body;

    // Basic validation
    if (
      !userId ||
      amount === undefined ||
      !direction ||
      !status ||
      !occurredAt
    ) {
      return res.status(400).json({
        success: false,
        message:
          "userId, amount, direction, status and occurredAt are required",
      });
    }

    // Check whether user exists
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If an entityId is provided, make sure
    // the entity belongs to the same user
    if (entityId) {
      const entity = await prisma.entity.findFirst({
        where: {
          id: entityId,
          userId,
        },
      });

      if (!entity) {
        return res.status(404).json({
          success: false,
          message: "Entity not found for this user",
        });
      }
    }

    // Create the financial event
    const financialEvent = await prisma.financialEvent.create({
      data: {
        userId,
        entityId: entityId || null,
        amount,
        direction,
        status,
        occurredAt: new Date(occurredAt),
        description: description || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Financial event created successfully",
      data: financialEvent,
    });
  } catch (error) {
    console.error("Create financial event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create financial event",
    });
  }
});

// Get all financial events for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const events = await prisma.financialEvent.findMany({
      where: {
        userId,
      },
      orderBy: {
        occurredAt: "desc",
      },
      include: {
        entity: {
          include: {
            aliases: true,
          },
        },
        sourceRecords: {
          include: {
            account: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get financial events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch financial events",
    });
  }
});

// Link a financial event to an entity
router.patch("/:eventId/entity", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { entityId } = req.body;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: "entityId is required",
      });
    }

    // Find the financial event
    const financialEvent = await prisma.financialEvent.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!financialEvent) {
      return res.status(404).json({
        success: false,
        message: "Financial event not found",
      });
    }

    // Make sure the entity belongs to the same user
    const entity = await prisma.entity.findFirst({
      where: {
        id: entityId,
        userId: financialEvent.userId,
      },
    });

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: "Entity not found for this user",
      });
    }

    // Link the event to the entity
    const updatedEvent = await prisma.financialEvent.update({
      where: {
        id: eventId,
      },
      data: {
        entityId,
      },
      include: {
        entity: {
          include: {
            aliases: true,
          },
        },
        sourceRecords: {
          include: {
            account: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: "Financial event linked to entity successfully",
      data: updatedEvent,
    });
  } catch (error) {
    console.error("Link entity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to link financial event to entity",
    });
  }
});

export default router;