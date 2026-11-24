-- AlterEnum
-- Kept alone in this migration: Postgres won't let a new enum value be used
-- until the transaction that added it commits, so the column default and
-- backfill that reference these values live in the next migration.
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_RESCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'SESSION_CONFIRMED';
