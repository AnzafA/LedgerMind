-- CreateEnum
CREATE TYPE "MatchDecision" AS ENUM ('SAME', 'NOT_SAME', 'REVIEW');

-- CreateTable
CREATE TABLE "EntityMatchDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "decision" "MatchDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityMatchDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityMatchDecision_userId_alias_idx" ON "EntityMatchDecision"("userId", "alias");

-- CreateIndex
CREATE INDEX "EntityMatchDecision_entityId_idx" ON "EntityMatchDecision"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityMatchDecision_userId_entityId_alias_key" ON "EntityMatchDecision"("userId", "entityId", "alias");

-- AddForeignKey
ALTER TABLE "EntityMatchDecision" ADD CONSTRAINT "EntityMatchDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMatchDecision" ADD CONSTRAINT "EntityMatchDecision_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
