import "server-only";
import type { Prisma, RsvpStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { discordApi } from "@/lib/discord/api";
import { groupDay, loadCampaignAway } from "@/lib/away";
import { awayOn } from "@/lib/awayDays";

export type DiscordEmbed = {
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

/** Who's answered what, as embed fields: names per answer, plus who hasn't
 * replied (or is away that day). */
async function rsvpFields(sessionId: string) {
  const session = await prisma.sessionProposal.findUnique({
    where: { id: sessionId },
    select: {
      status: true,
      startsAt: true,
      campaignId: true,
      rsvps: { select: { status: true, memberId: true } },
      campaign: {
        select: {
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
  return { fields, open: session.status === "PROPOSED" || session.status === "CONFIRMED", status: session.status };
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
  const rsvp = await rsvpFields(input.sessionId);
  if (!rsvp) return;
  const message = await discordApi<DiscordMessage>("POST", `/channels/${input.channelId}/messages`, {
    content: input.content || undefined,
    embeds: [{ ...input.embed, fields: rsvp.fields }],
    components: rsvp.open ? rsvpButtons(input.sessionId, input.embed.url) : [],
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
 * Brings every bot post about a session up to date: the latest answers,
 * and no buttons once the session is cancelled or has been played.
 * Fire-and-forget from anywhere that changes RSVPs or the session.
 */
export async function refreshSessionMessages(sessionId: string) {
  const messages = await prisma.discordSessionMessage.findMany({ where: { sessionProposalId: sessionId } });
  if (messages.length === 0) return;
  const rsvp = await rsvpFields(sessionId);
  if (!rsvp) return;
  const closedNote =
    rsvp.status === "CANCELLED" ? "This session was cancelled." : rsvp.status === "COMPLETED" ? "This session has been played." : null;

  await Promise.all(
    messages.map((m) => {
      const embed = m.embed as DiscordEmbed;
      const fields = closedNote ? [{ name: "Closed", value: closedNote, inline: false }, ...rsvp.fields] : rsvp.fields;
      return discordApi("PATCH", `/channels/${m.channelId}/messages/${m.messageId}`, {
        embeds: [{ ...embed, fields }],
        components: rsvp.open ? rsvpButtons(sessionId, embed.url) : [],
      });
    }),
  );
}

/** The session id in an in-app link like /campaigns/abc/sessions/xyz. */
export function sessionIdFromLink(link: string | undefined): string | null {
  return link?.match(/\/sessions\/([^/?#]+)$/)?.[1] ?? null;
}
