import "server-only";
import { prisma } from "@/lib/prisma";
import { postToDiscordWebhook } from "@/lib/discordWebhook";
import { getRequestOrigin } from "@/lib/requestOrigin";
import type { NotificationType } from "@prisma/client";

/** Mirrors whatever just got written to the in-app Notification to the
 * campaign's Discord webhook, if one is configured AND this event type is
 * one the DM has it set to post (per-campaign, in Settings). Looked up
 * here rather than at each of the call sites below, so every event that
 * already creates an in-app notification — current and future — gets
 * Discord support for free. Fire-and-forget: the webhook POST itself isn't
 * awaited, so a slow or unreachable Discord never adds latency to the
 * action that triggered it. */
async function notifyDiscord(
  campaignId: string | null | undefined,
  input: { type: NotificationType; title: string; body?: string; link?: string },
) {
  if (!campaignId) return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { discordWebhookUrl: true, discordWebhookEvents: true },
  });
  if (!campaign?.discordWebhookUrl) return;
  if (!campaign.discordWebhookEvents.includes(input.type)) return;

  const origin = await getRequestOrigin();
  void postToDiscordWebhook(campaign.discordWebhookUrl, {
    title: input.title,
    body: input.body,
    url: input.link ? `${origin}${input.link}` : undefined,
  });
}

export async function createNotification(input: {
  recipientId: string;
  campaignId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  const notification = await prisma.notification.create({ data: input });
  await notifyDiscord(input.campaignId, input);
  return notification;
}

/**
 * Notify every member of a campaign (optionally excluding one user, e.g. the
 * actor who triggered the event).
 */
export async function notifyCampaignMembers(
  campaignId: string,
  input: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    excludeUserId?: string;
  },
) {
  const members = await prisma.campaignMember.findMany({
    where: {
      campaignId,
      ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {}),
    },
    select: { userId: true },
  });

  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((m) => ({
        recipientId: m.userId,
        campaignId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      })),
    });
  }

  // Independent of in-app recipients: the Discord post is a channel
  // broadcast, not a per-member notification, so it still fires even if
  // everyone who'd otherwise get an in-app notification was excluded.
  await notifyDiscord(campaignId, input);
}
