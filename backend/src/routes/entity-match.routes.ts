import { Router } from "express";
import { prisma } from "../config/prisma";
import {
  normalizeName,
  normalizeIdentifier,
  normalizeAlias,
} from "../utils/normalize";

const router = Router();

router.post("/match", async (req, res) => {
  try {
    const { userId, input } = req.body;

    if (!userId || !input) {
      return res.status(400).json({
        success: false,
        message: "userId and input are required",
      });
    }

    const normalizedInput = normalizeAlias(input);

    /*
     * STEP 1
     * Check Financial Memory first.
     */

    const rememberedDecisions =
      await prisma.entityMatchDecision.findMany({
        where: {
          userId,
        },
        include: {
          entity: true,
        },
      });

    // Previously confirmed SAME → return immediately
    const sameMatches = rememberedDecisions.filter(
      (decision) =>
        decision.decision === "SAME" &&
        normalizeAlias(decision.alias) === normalizedInput
    );

    if (sameMatches.length > 0) {
      return res.json({
        success: true,
        source: "financial-memory",
        matches: sameMatches.map((decision) => ({
          entityId: decision.entity.id,
          entityName: decision.entity.name,
          alias: decision.alias,
          matchedBy: "MEMORY",
          decision: decision.decision,
        })),
      });
    }

    /*
     * STEP 2
     * No remembered SAME match.
     * Search normal entities and aliases.
     */

    const entities = await prisma.entity.findMany({
      where: {
        userId,
      },
      include: {
        aliases: true,
      },
    });

    const matches: {
      entityId: string;
      entityName: string;
      alias?: string;
      matchedBy: "ENTITY_NAME" | "ALIAS";
    }[] = [];

    for (const entity of entities) {
      /*
       * Check whether this input was previously marked
       * NOT_SAME for this entity.
       */

      const rejectedEntityMatch = rememberedDecisions.some(
        (decision) =>
          decision.entityId === entity.id &&
          decision.decision === "NOT_SAME" &&
          normalizeAlias(decision.alias) === normalizedInput
      );

      if (rejectedEntityMatch) {
        continue;
      }

      /*
       * Match against entity name.
       */

      const normalizedEntityName = normalizeName(entity.name);

      if (
        normalizedInput.includes(normalizedEntityName) ||
        normalizedEntityName.includes(normalizedInput)
      ) {
        matches.push({
          entityId: entity.id,
          entityName: entity.name,
          matchedBy: "ENTITY_NAME",
        });

        continue;
      }

      /*
       * Match against aliases.
       */

      for (const alias of entity.aliases) {
        const normalizedAlias = normalizeAlias(alias.alias);

        if (
          normalizedInput.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedInput)
        ) {
          matches.push({
            entityId: entity.id,
            entityName: entity.name,
            alias: alias.alias,
            matchedBy: "ALIAS",
          });
        }
      }
    }

    return res.json({
      success: true,
      source: "matching",
      matches,
    });
  } catch (error) {
    console.error("Entity matching error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to match entity",
    });
  }
});

export default router;