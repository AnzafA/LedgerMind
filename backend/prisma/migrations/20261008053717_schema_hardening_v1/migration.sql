/*
  Warnings:

  - A unique constraint covering the columns `[accountId,sourceReference]` on the table `TransactionRecord` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[accountId,rawRowHash]` on the table `TransactionRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('SAVINGS', 'CURRENT', 'OD_CC', 'SALARY', 'JOINT', 'NRE', 'NRO', 'CREDIT_CARD', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'BUSINESS', 'GOVERNMENT', 'BANK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('UPI', 'ACCOUNT_NUMBER', 'IFSC', 'PHONE', 'EMAIL', 'NAME_FRAGMENT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'SAVINGS',
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "ifsc" TEXT,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nickname" TEXT;

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "type" "EntityType" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "TransactionRecord" ADD COLUMN     "rawRowHash" TEXT;

-- CreateTable
CREATE TABLE "EntityIdentifier" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "rawValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "fileName" TEXT,
    "fileHash" TEXT NOT NULL,
    "parsedCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityIdentifier_type_value_idx" ON "EntityIdentifier"("type", "value");

-- CreateIndex
CREATE INDEX "EntityIdentifier_entityId_idx" ON "EntityIdentifier"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityIdentifier_entityId_type_value_key" ON "EntityIdentifier"("entityId", "type", "value");

-- CreateIndex
CREATE INDEX "StatementImport_userId_startedAt_idx" ON "StatementImport"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "StatementImport_accountId_startedAt_idx" ON "StatementImport"("accountId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StatementImport_userId_fileHash_key" ON "StatementImport"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "Entity_userId_type_idx" ON "Entity"("userId", "type");

-- CreateIndex
CREATE INDEX "EntityMatchDecision_userId_decision_idx" ON "EntityMatchDecision"("userId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionRecord_accountId_sourceReference_key" ON "TransactionRecord"("accountId", "sourceReference");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionRecord_accountId_rawRowHash_key" ON "TransactionRecord"("accountId", "rawRowHash");

-- AddForeignKey
ALTER TABLE "EntityIdentifier" ADD CONSTRAINT "EntityIdentifier_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
