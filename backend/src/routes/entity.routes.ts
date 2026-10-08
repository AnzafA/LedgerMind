import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Create an entity
router.post("/", async (req, res) => {
  try {
    const { userId, name } = req.body;

    if (!userId || !name) {
      return res.status(400).json({
        success: false,
        message: "userId and name are required",
      });
    }

    // Verify user exists
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

    const entity = await prisma.entity.create({
      data: {
        userId,
        name,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Entity created successfully",
      data: entity,
    });
  } catch (error) {
    console.error("Create entity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create entity",
    });
  }
});

// Add an alias to an entity
router.post("/:entityId/aliases", async (req, res) => {
  try {
    const { entityId } = req.params;
    const { alias } = req.body;

    if (!alias) {
      return res.status(400).json({
        success: false,
        message: "alias is required",
      });
    }

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

    const entityAlias = await prisma.entityAlias.create({
      data: {
        entityId,
        alias,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Alias added successfully",
      data: entityAlias,
    });
  } catch (error) {
    console.error("Add alias error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add alias",
    });
  }
});

// Get all entities belonging to a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const entities = await prisma.entity.findMany({
      where: {
        userId,
      },
      include: {
        aliases: true,
        financialEvents: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      data: entities,
    });
  } catch (error) {
    console.error("Get entities error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch entities",
    });
  }
});

export default router;