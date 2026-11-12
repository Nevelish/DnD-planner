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

export const discordWebhookUrlSchema = z.object({
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
});
