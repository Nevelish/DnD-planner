-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "discordWebhookEvents" SET DEFAULT ARRAY['SESSION_PROPOSED', 'SESSION_RESCHEDULED', 'SESSION_CONFIRMED', 'SESSION_CANCELLED', 'SESSION_REMINDER', 'RSVP_CHANGED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'RECURRING_DRAFT_READY']::"NotificationType"[];

-- Backfill: existing campaigns get reminders posted to Discord too, same as
-- new campaigns. Nobody could have opted out of a type that didn't exist.
UPDATE "Campaign"
SET "discordWebhookEvents" = "discordWebhookEvents" || ARRAY['SESSION_REMINDER']::"NotificationType"[]
WHERE NOT ('SESSION_REMINDER' = ANY("discordWebhookEvents"));
