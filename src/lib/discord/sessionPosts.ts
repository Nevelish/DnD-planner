import "server-only";
import type { Prisma, RsvpStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { discordApi } from "@/lib/discord/api";
import { groupDay, loadCampaignAway } from "@/lib/away";
import { awayOn } from "@/lib/awayDays";
import { describePlace } from "@/lib/sessionPlace";

export type DiscordEmbed = {
  author?: { name: string };
  title: string;
  description?: string;
  url?: string;
  color?: number;
  footer?: { text: string };
  timestamp?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
};

type DiscordMessage = { id: string; channel_id: string };

/** Button ids: "rsvp:<sessionId>:YES". Discord allows up to 100 characters. */
export const rsvpButtonId = (sessionId: string, status: "YES" | "MAYBE" | "NO") => `rsvp:${sessionId}:${status}`;

function rsvpButtons(sessionId: string, url?: string) {
  return [
    {
      type: 1, // action row
      components: [
        { type: 2, style: 3, label: "I'm in", custom_id: rsvpButtonId(sessionId, "YES") },
        { type: 2, style: 2, label: "Maybe", custom_id: rsvpButtonId(sessionId, "MAYBE") },
        { type: 2, style: 4, label: "Can't make it", custom_id: rsvpButtonId(sessionId, "NO") },
        ...(url ? [{ type: 2, style: 5, label: "Open in planner", url }] : []),
      ],
    },
  ];
}

const LINE = { YES: "Going", MAYBE: "Maybe", NO: "Can't make it" } as const;

const STATUS_COLOR = { PROPOSED: 0x3a7ca5, CONFIRMED: 0x57a64a, CANCELLED: 0xd9534f, COMPLETED: 0x8a8a8a } as const;

/** Discord renders <t:…> in each reader's own timezone and language. */
const at = (date: Date, style: "F" | "R") => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;

/**
 * A bot post about a session, as it should look right now: what was
 * announced (e.g. "New session proposed") above the session's current
 * title, time, status and place, then who's answered what. Built fresh each
 * time, so a reschedule or confirmation shows on the original post.
 */
async function sessionCard(sessionId: string, announcement: Pick<DiscordEmbed, "title" | "url">) {
  const session = await prisma.sessionProposal.findUnique({
    where: { id: sessionId },
    select: {
      title: true,
      status: true,
      startsAt: true,
      format: true,
      location: true,
      campaignId: true,
      rsvps: { select: { status: true, memberId: true } },
      campaign: {
        select: {
          name: true,
          members: {
            where: { role: "PLAYER" },
            orderBy: { joinedAt: "asc" },
            select: { id: true, userId: true, user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!session) return null;

  const answer = new Map<string, RsvpStatus>(session.rsvps.map((r) => [r.memberId, r.status]));
  const away = new Set(awayOn(await loadCampaignAway(session.campaignId), groupDay(session.startsAt)).map((a) => a.userId));
  const groups: Record<"YES" | "MAYBE" | "NO" | "PENDING" | "AWAY", string[]> = { YES: [], MAYBE: [], NO: [], PENDING: [], AWAY: [] };
  for (const member of session.campaign.members) {
    const name = member.user.name ?? member.user.email ?? "Someone";
    const status = answer.get(member.id) ?? "PENDING";
    if (status === "PENDING" && away.has(member.userId)) groups.AWAY.push(name);
    else groups[status].push(name);
  }

  const fields = (["YES", "MAYBE", "NO"] as const).map((status) => ({
    name: `${LINE[status]} (${groups[status].length})`,
    value: groups[status].join(", ") || "—",
    inline: true,
  }));
  if (groups.PENDING.length) fields.push({ name: `No reply yet (${groups.PENDING.length})`, value: groups.PENDING.join(", "), inline: false });
  if (groups.AWAY.length) fields.push({ name: `Away (${groups.AWAY.length})`, value: groups.AWAY.join(", "), inline: false });

  const status = session.status as keyof typeof STATUS_COLOR | "DRAFT";
  const lines = [`${at(session.startsAt, "F")} (${at(session.startsAt, "R")})`];
  if (status === "PROPOSED") lines.push("Proposed: answer below so the DM knows who's in.");
  if (status === "CONFIRMED") lines.push("**Confirmed**: it's on!");
  if (status === "CANCELLED") lines.push("**Cancelled**");
  if (status === "COMPLETED") lines.push("Played");
  const place = describePlace(session.format, session.location);
  if (place) lines.push(place);

  const embed: DiscordEmbed = {
    author: { name: announcement.title },
    title: session.title || "Next session",
    url: announcement.url,
    description: lines.join("\n"),
    color: status === "DRAFT" ? STATUS_COLOR.PROPOSED : STATUS_COLOR[status],
    footer: { text: session.campaign.name },
    fields,
  };
  return { embed, open: status === "PROPOSED" || status === "CONFIRMED" };
}

/**
 * Posts a session announcement to the campaign's channel as the bot, with
 * RSVP buttons and the current answers, and remembers the message so the
 * answers on it can be kept up to date.
 */
export async function postSessionMessage(input: {
  channelId: string;
  sessionId: string;
  embed: DiscordEmbed;
  content?: string;
  mentionDiscordIds?: string[];
}) {
  const card = await sessionCard(input.sessionId, input.embed);
  if (!card) return;
  const message = await discordApi<DiscordMessage>("POST", `/channels/${input.channelId}/messages`, {
    content: input.content || undefined,
    embeds: [card.embed],
    components: card.open ? rsvpButtons(input.sessionId, input.embed.url) : [],
    allowed_mentions: { parse: [], users: input.mentionDiscordIds ?? [] },
  });
  if (!message?.id) return;
  await prisma.discordSessionMessage.create({
    data: {
      sessionProposalId: input.sessionId,
      channelId: input.channelId,
      messageId: message.id,
      embed: input.embed as Prisma.InputJsonValue,
    },
  });
}

/** Posts anything else (no buttons) to the campaign's channel as the bot. */
export async function postChannelMessage(input: {
  channelId: string;
  embed: DiscordEmbed;
  content?: string;
  mentionDiscordIds?: string[];
}) {
  return discordApi<DiscordMessage>("POST", `/channels/${input.channelId}/messages`, {
    content: input.content || undefined,
    embeds: [input.embed],
    allowed_mentions: { parse: [], users: input.mentionDiscordIds ?? [] },
  });
}

/**
 * Brings every bot post about a session up to date: its time, status and
 * place, the latest answers, and no buttons once the session is cancelled
 * or has been played. Fire-and-forget from anywhere that changes RSVPs or
 * the session.
 */
export async function refreshSessionMessages(sessionId: string) {
  const messages = await prisma.discordSessionMessage.findMany({ where: { sessionProposalId: sessionId } });
  await Promise.all(
    messages.map(async (m) => {
      const card = await sessionCard(sessionId, m.embed as DiscordEmbed);
      if (!card) return;
      await discordApi("PATCH", `/channels/${m.channelId}/messages/${m.messageId}`, {
        embeds: [card.embed],
        components: card.open ? rsvpButtons(sessionId, (m.embed as DiscordEmbed).url) : [],
      });
    }),
  );
}

/**
 * Posts an update about a session (moved, confirmed, cancelled, a reminder)
 * as a reply to the bot's post about it in this channel, so everything about
 * one session stays together. Returns false if there's no post to reply to.
 */
export async function replyToSessionMessage(input: {
  channelId: string;
  sessionId: string;
  embed: DiscordEmbed;
  content?: string;
  mentionDiscordIds?: string[];
}) {
  const original = await prisma.discordSessionMessage.findFirst({
    where: { sessionProposalId: input.sessionId, channelId: input.channelId },
    orderBy: { createdAt: "desc" },
  });
  if (!original) return false;
  await discordApi("POST", `/channels/${input.channelId}/messages`, {
    content: input.content || undefined,
    embeds: [input.embed],
    message_reference: { message_id: original.messageId, channel_id: input.channelId, fail_if_not_exists: false },
    allowed_mentions: { parse: [], users: input.mentionDiscordIds ?? [], replied_user: false },
  });
  return true;
}

/** The session id in an in-app link like /campaigns/abc/sessions/xyz. */
export function sessionIdFromLink(link: string | undefined): string | null {
  return link?.match(/\/sessions\/([^/?#]+)$/)?.[1] ?? null;
}
