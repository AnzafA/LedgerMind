
import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { userId, entityId, alias, decision } = req.body;

    if (!userId || !entityId || !alias || !decision) {
      return res.status(400).json({
        success: false,
        message: "userId, entityId, alias and decision are required",
      });
    }

    if (!["SAME", "NOT_SAME", "REVIEW"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "decision must be SAME, NOT_SAME or REVIEW",
      });
    }

    // Make sure the entity belongs to the user
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

    const matchDecision = await prisma.entityMatchDecision.upsert({
      where: {
        userId_entityId_alias: {
          userId,
          entityId,
          alias,
        },
      },
      update: {
        decision,
      },
      create: {
        userId,
        entityId,
        alias,
        decision,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Entity match decision saved successfully",
      data: matchDecision,
    });
  } catch (error) {
    console.error("Save entity match decision error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save entity match decision",
    });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const decisions = await prisma.entityMatchDecision.findMany({
      where: {
        userId,
      },
      include: {
        entity: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.json({
      success: true,
      data: decisions,
    });
  } catch (error) {
    console.error("Get entity match decisions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch entity match decisions",
    });
  }
});

export default router;
