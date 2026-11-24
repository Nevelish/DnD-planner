import "server-only";
import { prisma } from "@/lib/prisma";
import { postToDiscordWebhook } from "@/lib/discordWebhook";
import { getRequestOrigin } from "@/lib/requestOrigin";
import type { NotificationType } from "@prisma/client";

// Fallback embed color per event type, used whenever a call site doesn't
// supply its own override (e.g. RSVP_CHANGED's Yes/No-specific color).
const DEFAULT_DISCORD_EMBED_COLORS: Record<NotificationType, number> = {
  CAMPAIGN_INVITE: 0xb87e40,
  MEMBER_JOINED: 0x57a64a,
  MEMBER_LEFT: 0xd9822b,
  SESSION_PROPOSED: 0x3a7ca5,
  SESSION_RESCHEDULED: 0xe0a33a,
  SESSION_CONFIRMED: 0x57a64a,
  SESSION_CANCELLED: 0xd9534f,
  SESSION_REMINDER: 0x6c8ebf,
  RSVP_CHANGED: 0xb87e40,
  RECURRING_DRAFT_READY: 0x8e6fbd,
};

// Event types worth @mentioning opted-in players for — the "this affects
// your plans, go look" events. Deliberately excludes RSVP_CHANGED and
// SESSION_CONFIRMED: pinging on every RSVP, or on a session merely being
// locked in, would be exactly the noise the event-filter exists to avoid.
const MENTION_EVENT_TYPES: NotificationType[] = [
  "SESSION_PROPOSED",
  "SESSION_RESCHEDULED",
  "SESSION_CANCELLED",
  "SESSION_REMINDER",
];

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
  input: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    color?: number;
    /** Limit @mentions to these users instead of everyone in the campaign. */
    mentionUserIds?: string[];
  },
) {
  if (!campaignId) return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true, discordWebhookUrl: true, discordWebhookEvents: true },
  });
  if (!campaign?.discordWebhookUrl) return;
  if (!campaign.discordWebhookEvents.includes(input.type)) return;

  let content: string | undefined;
  if (MENTION_EVENT_TYPES.includes(input.type)) {
    const members = await prisma.campaignMember.findMany({
      where: {
        campaignId,
        user: { discordUserId: { not: null } },
        ...(input.mentionUserIds ? { userId: { in: input.mentionUserIds } } : {}),
      },
      select: { user: { select: { discordUserId: true } } },
    });
    if (members.length > 0) {
      content = members.map((m) => `<@${m.user.discordUserId}>`).join(" ");
    }
  }

  const origin = await getRequestOrigin();
  void postToDiscordWebhook(campaign.discordWebhookUrl, {
    title: input.title,
    body: input.body,
    url: input.link ? `${origin}${input.link}` : undefined,
    color: input.color ?? DEFAULT_DISCORD_EMBED_COLORS[input.type],
    footerText: campaign.name,
    timestamp: new Date().toISOString(),
    content,
  });
}

export async function createNotification(input: {
  recipientId: string;
  campaignId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  color?: number;
}) {
  const notification = await prisma.notification.create({ data: input });
  await notifyDiscord(input.campaignId, input);
  return notification;
}

/**
 * Notify every member of a campaign (optionally excluding one user, e.g. the
 * actor who triggered the event), or only the given users — in which case
 * the Discord post @mentions only them too.
 */
export async function notifyCampaignMembers(
  campaignId: string,
  input: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    excludeUserId?: string;
    onlyUserIds?: string[];
    color?: number;
  },
) {
  const members = await prisma.campaignMember.findMany({
    where: {
      campaignId,
      userId: {
        ...(input.excludeUserId ? { not: input.excludeUserId } : {}),
        ...(input.onlyUserIds ? { in: input.onlyUserIds } : {}),
      },
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
  await notifyDiscord(campaignId, { ...input, mentionUserIds: input.onlyUserIds });
}
