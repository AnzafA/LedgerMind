import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

// Create an account
router.post("/", async (req, res) => {
  try {
    const { userId, name, bankName, accountLast4 } = req.body;

    if (!userId || !name) {
      return res.status(400).json({
        success: false,
        message: "userId and name are required",
      });
    }

    // Make sure the user actually exists
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

    const account = await prisma.account.create({
      data: {
        userId,
        name,
        bankName,
        accountLast4,
      },
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: account,
    });
  } catch (error) {
    console.error("Create account error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create account",
    });
  }
});

// Get all accounts belonging to a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const accounts = await prisma.account.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error("Get accounts error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch accounts",
    });
  }
});

export default router;