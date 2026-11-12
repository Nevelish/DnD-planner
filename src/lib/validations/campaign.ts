import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

// Restricted to Discord's own webhook URL shape — not just "any URL" — so
// this can't be turned into a blind server-side POST to an arbitrary
// (including internal/private-network) address.
const DISCORD_WEBHOOK_URL_PATTERN =
  /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;

// Event types a campaign's Discord webhook can be toggled on/off for.
// CAMPAIGN_INVITE isn't included — nothing in the app sends that type yet,
// so there's nothing meaningful to toggle for it.
export const DISCORD_WEBHOOK_EVENT_TYPES = [
  "SESSION_PROPOSED",
  "SESSION_CANCELLED",
  "RSVP_CHANGED",
  "MEMBER_JOINED",
  "MEMBER_LEFT",
  "RECURRING_DRAFT_READY",
] as const;

export const DISCORD_WEBHOOK_EVENT_LABELS: Record<
  (typeof DISCORD_WEBHOOK_EVENT_TYPES)[number],
  string
> = {
  SESSION_PROPOSED: "New session proposed",
  SESSION_CANCELLED: "Session cancelled",
  RSVP_CHANGED: "RSVP updated",
  MEMBER_JOINED: "Player joined",
  MEMBER_LEFT: "Player left",
  RECURRING_DRAFT_READY: "Recurring draft ready",
};

export const discordWebhookSettingsSchema = z.object({
  discordWebhookUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (value) => value === "" || DISCORD_WEBHOOK_URL_PATTERN.test(value),
      {
        message:
          "Enter a Discord webhook URL (from a channel's Integrations → Webhooks settings), or leave blank to turn this off.",
      },
    ),
  discordWebhookEvents: z.array(z.enum(DISCORD_WEBHOOK_EVENT_TYPES)),
});
