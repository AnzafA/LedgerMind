// backend/src/routes/entity-match.routes.ts

import { Router } from "express";
import { prisma } from "../config/prisma";
import {
  normalizeName,
  normalizeAlias,
  normalizeIdentifier,
  tokenizeName,
  isTokenSubset,
} from "../utils/normalize";

const router = Router();

type MatchedBy =
  | "MEMORY"
  | "IDENTIFIER"
  | "ENTITY_NAME"
  | "ALIAS"
  | "NAME_TOKEN_SUBSET"
  | "ALIAS_TOKEN_SUBSET";

interface Candidate {
  entityId: string;
  entityName: string;
  alias?: string;
  identifierType?: string;
  identifierValue?: string;
  confidence: number;
  matchedBy: MatchedBy;
  decision?: string;
}

/**
 * Deterministic confidence table.
 * Tune later with real data.
 */
const CONFIDENCE: Record<MatchedBy, number> = {
  MEMORY: 100,
  IDENTIFIER: 98,
  ENTITY_NAME: 95,
  ALIAS: 90,
  NAME_TOKEN_SUBSET: 75,
  ALIAS_TOKEN_SUBSET: 70,
};

router.post("/match", async (req, res) => {
  try {
    const { userId, input } = req.body;

    if (!userId || !input) {
      return res.status(400).json({
        success: false,
        message: "userId and input are required",
      });
    }

    const normalizedAliasInput = normalizeAlias(input);
    const normalizedNameInput = normalizeName(input);
    const normalizedIdentifierInput = normalizeIdentifier(input);
    const inputTokens = tokenizeName(input);

    /* ------------------------------------------------------------------
     * STEP 1 — Financial Memory (SAME)
     * ------------------------------------------------------------------ */

    const sameDecisions = await prisma.entityMatchDecision.findMany({
      where: {
        userId,
        decision: "SAME",
      },
      include: { entity: true },
    });

    const memoryMatches = sameDecisions.filter(
      (d) => normalizeAlias(d.alias) === normalizedAliasInput
    );

    if (memoryMatches.length > 0) {
      const matches: Candidate[] = memoryMatches.map((d) => ({
        entityId: d.entity.id,
        entityName: d.entity.name,
        alias: d.alias,
        confidence: CONFIDENCE.MEMORY,
        matchedBy: "MEMORY",
        decision: d.decision,
      }));

      return res.json({
        success: true,
        source: "financial-memory",
        matches,
      });
    }

    /* ------------------------------------------------------------------
     * STEP 2 — Load entities, aliases, identifiers, rejections
     * ------------------------------------------------------------------ */

    const [entities, notSameDecisions] = await Promise.all([
      prisma.entity.findMany({
        where: { userId },
        include: {
          aliases: true,
          identifiers: true,
        },
      }),
      prisma.entityMatchDecision.findMany({
        where: { userId, decision: "NOT_SAME" },
      }),
    ]);

    const rejectedByEntity = new Map<string, Set<string>>();
    for (const d of notSameDecisions) {
      if (!rejectedByEntity.has(d.entityId)) {
        rejectedByEntity.set(d.entityId, new Set());
      }
      rejectedByEntity.get(d.entityId)!.add(normalizeAlias(d.alias));
    }

    const candidates: Candidate[] = [];

    for (const entity of entities) {
      const rejectedAliases = rejectedByEntity.get(entity.id);
      if (rejectedAliases?.has(normalizedAliasInput)) continue;

      // 2a. Identifier match (strongest after memory)
      for (const ident of entity.identifiers) {
        if (
          ident.type !== "NAME_FRAGMENT" &&
          normalizeIdentifier(ident.value) === normalizedIdentifierInput
        ) {
          candidates.push({
            entityId: entity.id,
            entityName: entity.name,
            identifierType: ident.type,
            identifierValue: ident.value,
            confidence: CONFIDENCE.IDENTIFIER,
            matchedBy: "IDENTIFIER",
          });
          break;
        }
      }

      // 2b. Exact entity name
      if (normalizeName(entity.name) === normalizedNameInput) {
        candidates.push({
          entityId: entity.id,
          entityName: entity.name,
          confidence: CONFIDENCE.ENTITY_NAME,
          matchedBy: "ENTITY_NAME",
        });
        continue;
      }

      // 2c. Exact alias
      const exactAlias = entity.aliases.find(
        (a) => normalizeAlias(a.alias) === normalizedAliasInput
      );
      if (exactAlias) {
        candidates.push({
          entityId: entity.id,
          entityName: entity.name,
          alias: exactAlias.alias,
          confidence: CONFIDENCE.ALIAS,
          matchedBy: "ALIAS",
        });
        continue;
      }

      // 2d. Name token-subset
      if (isTokenSubset(inputTokens, tokenizeName(entity.name))) {
        candidates.push({
          entityId: entity.id,
          entityName: entity.name,
          confidence: CONFIDENCE.NAME_TOKEN_SUBSET,
          matchedBy: "NAME_TOKEN_SUBSET",
        });
        continue;
      }

      // 2e. Alias token-subset
      const subsetAlias = entity.aliases.find((a) =>
        isTokenSubset(inputTokens, tokenizeName(a.alias))
      );
      if (subsetAlias) {
        candidates.push({
          entityId: entity.id,
          entityName: entity.name,
          alias: subsetAlias.alias,
          confidence: CONFIDENCE.ALIAS_TOKEN_SUBSET,
          matchedBy: "ALIAS_TOKEN_SUBSET",
        });
      }
    }

    /* ------------------------------------------------------------------
     * STEP 3 — De-duplicate candidates by entityId, keep best confidence
     * ------------------------------------------------------------------ */

    const bestByEntity = new Map<string, Candidate>();
    for (const c of candidates) {
      const existing = bestByEntity.get(c.entityId);
      if (!existing || c.confidence > existing.confidence) {
        bestByEntity.set(c.entityId, c);
      }
    }

    const finalMatches = Array.from(bestByEntity.values()).sort(
      (a, b) => b.confidence - a.confidence
    );

    return res.json({
      success: true,
      source: "matching",
      matches: finalMatches,
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