-- CreateEnum
CREATE TYPE "SafetyKind" AS ENUM ('LINE', 'VEIL');

-- AlterEnum
-- The webhook default/backfill that use RECAP_POSTED live in the next
-- migration: Postgres won't use a new enum value before it's committed.
ALTER TYPE "NotificationType" ADD VALUE 'RECAP_POSTED';
ALTER TYPE "NotificationType" ADD VALUE 'SAFETY_TOOL_ADDED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "sessionZero" JSONB;

-- AlterTable
ALTER TABLE "SessionProposal" ADD COLUMN     "recap" TEXT,
ADD COLUMN     "recapAuthorId" TEXT,
ADD COLUMN     "recapUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SafetyEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "SafetyKind" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyEntry_campaignId_idx" ON "SafetyEntry"("campaignId");

-- AddForeignKey
ALTER TABLE "SessionProposal" ADD CONSTRAINT "SessionProposal_recapAuthorId_fkey" FOREIGN KEY ("recapAuthorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyEntry" ADD CONSTRAINT "SafetyEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyEntry" ADD CONSTRAINT "SafetyEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
