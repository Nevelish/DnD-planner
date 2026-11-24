-- CreateEnum
CREATE TYPE "SessionFormat" AS ENUM ('IN_PERSON', 'ONLINE');
-- AlterTable
ALTER TABLE "SessionProposal" ADD COLUMN     "description" TEXT,
ADD COLUMN     "format" "SessionFormat",
ADD COLUMN     "location" TEXT;
