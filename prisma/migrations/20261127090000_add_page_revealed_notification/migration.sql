-- On its own: Postgres can't use a new enum value in the same migration
-- that adds it.
ALTER TYPE "NotificationType" ADD VALUE 'PAGE_REVEALED';
