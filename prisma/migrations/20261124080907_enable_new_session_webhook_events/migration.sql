-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "discordWebhookEvents" SET DEFAULT ARRAY['SESSION_PROPOSED', 'SESSION_RESCHEDULED', 'SESSION_CONFIRMED', 'SESSION_CANCELLED', 'RSVP_CHANGED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'RECURRING_DRAFT_READY']::"NotificationType"[];

-- Backfill: existing campaigns get the two new event types switched on,
-- same as new campaigns. Nobody could have opted out of a type that
-- didn't exist yet.
UPDATE "Campaign"
SET "discordWebhookEvents" = "discordWebhookEvents" || ARRAY['SESSION_RESCHEDULED']::"NotificationType"[]
WHERE NOT ('SESSION_RESCHEDULED' = ANY("discordWebhookEvents"));

UPDATE "Campaign"
SET "discordWebhookEvents" = "discordWebhookEvents" || ARRAY['SESSION_CONFIRMED']::"NotificationType"[]
WHERE NOT ('SESSION_CONFIRMED' = ANY("discordWebhookEvents"));
