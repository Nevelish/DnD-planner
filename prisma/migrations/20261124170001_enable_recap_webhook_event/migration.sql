-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "discordWebhookEvents" SET DEFAULT ARRAY['SESSION_PROPOSED', 'SESSION_RESCHEDULED', 'SESSION_CONFIRMED', 'SESSION_CANCELLED', 'SESSION_REMINDER', 'DATE_POLL_OPENED', 'RECAP_POSTED', 'RSVP_CHANGED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'RECURRING_DRAFT_READY']::"NotificationType"[];

-- Backfill: existing campaigns post new recaps to Discord too, same as new
-- campaigns. Nobody could have opted out of a type that didn't exist.
-- SAFETY_TOOL_ADDED is deliberately never posted to Discord.
UPDATE "Campaign"
SET "discordWebhookEvents" = "discordWebhookEvents" || ARRAY['RECAP_POSTED']::"NotificationType"[]
WHERE NOT ('RECAP_POSTED' = ANY("discordWebhookEvents"));
