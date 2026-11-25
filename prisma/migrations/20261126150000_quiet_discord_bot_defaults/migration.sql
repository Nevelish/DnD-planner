-- Campaigns already posting through the Discord bot get its quieter
-- defaults: their session posts show RSVP answers themselves, so separate
-- posts for each answer (and members joining/leaving, recurring drafts) are
-- switched off. They stay in everyone's in-app notifications, and the DM can
-- turn any back on in the campaign's settings.
UPDATE "Campaign"
SET "discordWebhookEvents" = array_remove(array_remove(array_remove(array_remove(
      "discordWebhookEvents",
      'RSVP_CHANGED'), 'MEMBER_JOINED'), 'MEMBER_LEFT'), 'RECURRING_DRAFT_READY')
WHERE "discordChannelId" IS NOT NULL;
