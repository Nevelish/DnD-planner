-- AlterEnum
-- Kept apart from anything that uses the new value: Postgres won't let a
-- new enum value be used until the transaction that added it commits.
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_REMINDER';

-- AlterTable
ALTER TABLE "SessionProposal" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
