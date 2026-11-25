import "server-only";
import { prisma } from "@/lib/prisma";
import { postToDiscordWebhook } from "@/lib/discordWebhook";
import { getRequestOrigin } from "@/lib/requestOrigin";
import type { NotificationType } from "@prisma/client";
import { MENTION_EVENT_TYPES } from "@/lib/notificationPrefs";
import { discordBotConfig } from "@/lib/discord/api";
import {
  postChannelMessage,
  postSessionMessage,
  refreshSessionMessages,
  replyToSessionMessage,
  sessionIdFromLink,
  type DiscordEmbed,
} from "@/lib/discord/sessionPosts";
import {
  pollIdFromLink,
  postPollMessage,
  refreshPollMessages,
  replyToPollMessage,
} from "@/lib/discord/pollPosts";

// With the Discord bot, posts about these get RSVP buttons...
const RSVP_BUTTON_TYPES: NotificationType[] = [
  "SESSION_PROPOSED",
  "SESSION_RESCHEDULED",
  "SESSION_CONFIRMED",
  "SESSION_REMINDER",
];
// ...and these are replies to the session's existing post (which is also
// updated), so everything about one session stays together in the channel.
const REPLY_TYPES: NotificationType[] = [
  "SESSION_RESCHEDULED",
  "SESSION_CONFIRMED",
  "SESSION_CANCELLED",
  "SESSION_REMINDER",
];

/** Posts one event as the bot: a reply to the session's (or poll's) post
 * where there is one, a new post with buttons for session and poll news, a
 * plain post otherwise. */
async function postViaBot(input: {
  type: NotificationType;
  channelId: string;
  sessionId: string | null;
  pollId: string | null;
  embed: DiscordEmbed;
  content?: string;
  mentionDiscordIds: string[];
}) {
  const { type, channelId, sessionId, pollId, embed, content, mentionDiscordIds } = input;
  if (pollId && type === "DATE_POLL_OPENED") {
    // A new poll gets a post with a Vote button; news about one that's
    // already posted (a date was added) is a reply to it.
    if (await replyToPollMessage({ channelId, pollId, embed, content, mentionDiscordIds })) return;
    await postPollMessage({ channelId, pollId, embed, content, mentionDiscordIds });
    return;
  }
  if (sessionId && REPLY_TYPES.includes(type)) {
    if (await replyToSessionMessage({ channelId, sessionId, embed, content, mentionDiscordIds })) return;
  }
  if (sessionId && RSVP_BUTTON_TYPES.includes(type)) {
    await postSessionMessage({ channelId, sessionId, embed, content, mentionDiscordIds });
  } else {
    await postChannelMessage({ channelId, embed, content, mentionDiscordIds });
  }
}

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
  DATE_POLL_OPENED: 0x8e6fbd,
  RECAP_POSTED: 0x6c8ebf,
  // Never posted (not a webhook toggle), but the map covers every type.
  SAFETY_TOOL_ADDED: 0xd9822b,
  RSVP_CHANGED: 0xb87e40,
  RECURRING_DRAFT_READY: 0x8e6fbd,
};

/** Mirrors whatever just got written to the in-app Notification to the
 * campaign's Discord channel, if this event type is one the DM has set to
 * post (per-campaign, in Settings). Campaigns connected to the Discord bot
 * get it from the bot (with RSVP buttons on session posts); others through
 * their webhook, if they have one. Looked up here rather than at each call
 * site, so every event that creates an in-app notification gets Discord
 * support for free. Fire-and-forget: the Discord request itself isn't
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
    /** Never @mention this user — the person who caused the event. */
    excludeUserId?: string;
  },
) {
  if (!campaignId) return;
  // Lines and veils are private to the group; never post them to a channel.
  if (input.type === "SAFETY_TOOL_ADDED") return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true, discordWebhookUrl: true, discordWebhookEvents: true, discordChannelId: true },
  });
  if (!campaign) return;

  // Whatever happened to a session or poll (an RSVP, a reschedule, a new
  // date), the bot's earlier posts about it should show it, posted or not.
  const sessionId = sessionIdFromLink(input.link);
  const pollId = pollIdFromLink(input.link);
  const useBot = !!campaign.discordChannelId && !!discordBotConfig();
  if (sessionId && useBot) void refreshSessionMessages(sessionId);
  if (pollId && useBot) void refreshPollMessages(pollId);

  if (!useBot && !campaign.discordWebhookUrl) return;
  if (!campaign.discordWebhookEvents.includes(input.type)) return;

  let mentionDiscordIds: string[] = [];
  if (MENTION_EVENT_TYPES.includes(input.type)) {
    const members = await prisma.campaignMember.findMany({
      where: {
        campaignId,
        user: {
          discordUserId: { not: null },
          // Respects each person's Account → Notifications choices.
          NOT: { mutedMentionTypes: { has: input.type } },
        },
        userId: {
          ...(input.mentionUserIds ? { in: input.mentionUserIds } : {}),
          ...(input.excludeUserId ? { not: input.excludeUserId } : {}),
        },
      },
      select: { user: { select: { discordUserId: true } } },
    });
    mentionDiscordIds = members.map((m) => m.user.discordUserId!);
  }
  const content = mentionDiscordIds.map((id) => `<@${id}>`).join(" ") || undefined;

  const origin = await getRequestOrigin();
  const url = input.link ? `${origin}${input.link}` : undefined;
  const color = input.color ?? DEFAULT_DISCORD_EMBED_COLORS[input.type];
  const timestamp = new Date().toISOString();

  if (useBot) {
    const embed = {
      title: input.title,
      description: input.body || undefined,
      url,
      color,
      footer: { text: campaign.name },
      timestamp,
    };
    void postViaBot({
      type: input.type,
      channelId: campaign.discordChannelId!,
      sessionId,
      pollId,
      embed,
      content,
      mentionDiscordIds,
    });
    return;
  }

  void postToDiscordWebhook(campaign.discordWebhookUrl!, {
    title: input.title,
    body: input.body,
    url,
    color,
    footerText: campaign.name,
    timestamp,
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
  const recipient = await prisma.user.findUnique({
    where: { id: input.recipientId },
    select: { mutedNotificationTypes: true },
  });
  // A muted type skips the in-app notification only; the channel post is
  // the campaign's, not this person's, so it still goes out.
  if (recipient && !recipient.mutedNotificationTypes.includes(input.type)) {
    await prisma.notification.create({ data: input });
  }
  await notifyDiscord(input.campaignId, { ...input, mentionUserIds: [input.recipientId] });
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
      user: { NOT: { mutedNotificationTypes: { has: input.type } } },
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
