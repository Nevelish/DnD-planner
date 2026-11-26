import "server-only";
import type { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { discordApi } from "@/lib/discord/api";
import { groupDay, loadCampaignAway } from "@/lib/away";
import { awayOn } from "@/lib/awayDays";
import { bestOptionId, isPast, tallyOption } from "@/lib/pollResults";
import { getServerTimeZone } from "@/lib/timezone";
import type { DiscordEmbed } from "@/lib/discord/sessionPosts";
import { MAX_POLL_OPTIONS } from "@/lib/validations/poll";

type DiscordMessage = { id: string };

const POLL_COLOR = 0x8e6fbd;

/** Button and dropdown ids: "pollvote:<pollId>", "pollyes:<pollId>", "pollmaybe:<pollId>". */
export const pollVoteButtonId = (pollId: string) => `pollvote:${pollId}`;

const at = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;
const names = (ids: string[], nameOf: Map<string, string>) => ids.map((id) => nameOf.get(id)).join(", ");

/**
 * A bot post about a date poll, as it should look right now: every date with
 * who said what, the best one so far, and a Vote button while it's open.
 * Once a date is picked it says which, and links to the session instead.
 */
async function pollCard(pollId: string, announcement: Pick<DiscordEmbed, "title" | "url">) {
  const poll = await prisma.datePoll.findUnique({
    where: { id: pollId },
    select: {
      title: true,
      status: true,
      campaignId: true,
      sessionProposal: { select: { id: true, startsAt: true } },
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
      options: {
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, votes: { select: { memberId: true, choice: true } } },
      },
    },
  });
  if (!poll) return null;

  const players = poll.campaign.members;
  const playerIds = players.map((p) => p.id);
  const nameOf = new Map(players.map((p) => [p.id, p.user.name ?? p.user.email ?? "Someone"]));
  const memberOfUser = new Map(players.map((p) => [p.userId, p.id]));
  const away = await loadCampaignAway(poll.campaignId);
  const options = poll.options.map((o) => ({ ...o, tally: tallyOption(o.votes, playerIds) }));
  const bestId = poll.status === "OPEN" ? bestOptionId(options) : null;
  const voted = players.filter((p) => poll.options.some((o) => o.votes.some((v) => v.memberId === p.id))).length;

  const lines: string[] = [];
  if (poll.status === "OPEN") lines.push("Click **Vote** to mark every date you could make.", "");
  if (poll.status === "DECIDED" && poll.sessionProposal) lines.push(`**Date picked:** ${at(poll.sessionProposal.startsAt)}`, "");
  if (poll.status === "CANCELLED") lines.push("**This poll was cancelled.**", "");

  options.forEach((option, i) => {
    const picked = poll.sessionProposal?.startsAt.getTime() === option.startsAt.getTime();
    const date = isPast(option.startsAt) && !picked ? `~~${at(option.startsAt)}~~` : at(option.startsAt);
    lines.push(`**${i + 1}.** ${date}${option.id === bestId ? " · **Best so far**" : ""}${picked ? " · **Picked**" : ""}`);

    // Someone away that day who hasn't answered shows as away, not "no reply".
    const awayIds = new Set(
      awayOn(away, groupDay(option.startsAt))
        .map((a) => memberOfUser.get(a.userId))
        .filter((id): id is string => !!id && option.tally.noReply.includes(id)),
    );
    const noReply = option.tally.noReply.filter((id) => !awayIds.has(id));
    const parts = [
      `Yes ${option.tally.yes.length}${option.tally.yes.length ? `: ${names(option.tally.yes, nameOf)}` : ""}`,
      `Maybe ${option.tally.maybe.length}${option.tally.maybe.length ? `: ${names(option.tally.maybe, nameOf)}` : ""}`,
      `No ${option.tally.no.length}`,
    ];
    if (noReply.length) parts.push(`No reply: ${names(noReply, nameOf)}`);
    if (awayIds.size) parts.push(`Away: ${names([...awayIds], nameOf)}`);
    lines.push(parts.join(" · "), "");
  });
  lines.push(`${voted} of ${players.length} ${players.length === 1 ? "player has" : "players have"} voted`);

  const sessionUrl =
    poll.sessionProposal && announcement.url
      ? announcement.url.replace(/\/polls\/[^/?#]+$/, `/sessions/${poll.sessionProposal.id}`)
      : null;
  const buttons =
    poll.status === "OPEN"
      ? [
          { type: 2, style: 1, label: "Vote", custom_id: pollVoteButtonId(pollId) },
          ...(announcement.url ? [{ type: 2, style: 5, label: "Open in planner", url: announcement.url }] : []),
        ]
      : sessionUrl
        ? [{ type: 2, style: 5, label: "Go to the session", url: sessionUrl }]
        : [];

  const embed: DiscordEmbed = {
    author: { name: announcement.title },
    title: poll.title || "Find a date for the next session",
    url: announcement.url,
    description: lines.join("\n"),
    color: POLL_COLOR,
    footer: { text: poll.campaign.name },
  };
  return { embed, components: buttons.length ? [{ type: 1, components: buttons }] : [] };
}

/** Posts a new date poll to the campaign's channel as the bot, and remembers
 * the message so its counts can be kept up to date. */
export async function postPollMessage(input: {
  channelId: string;
  pollId: string;
  embed: DiscordEmbed;
  content?: string;
  mentionDiscordIds?: string[];
}) {
  const card = await pollCard(input.pollId, input.embed);
  if (!card) return;
  const message = await discordApi<DiscordMessage>("POST", `/channels/${input.channelId}/messages`, {
    content: input.content || undefined,
    embeds: [card.embed],
    components: card.components,
    allowed_mentions: { parse: [], users: input.mentionDiscordIds ?? [] },
  });
  if (!message?.id) return;
  await prisma.discordPollMessage.create({
    data: {
      pollId: input.pollId,
      channelId: input.channelId,
      messageId: message.id,
      embed: input.embed as Prisma.InputJsonValue,
    },
  });
}

/** Brings every bot post about a poll up to date. Fire-and-forget from
 * anything that changes the poll or its votes. */
export async function refreshPollMessages(pollId: string) {
  const messages = await prisma.discordPollMessage.findMany({ where: { pollId } });
  await Promise.all(
    messages.map(async (m) => {
      const card = await pollCard(pollId, m.embed as DiscordEmbed);
      if (!card) return;
      await discordApi("PATCH", `/channels/${m.channelId}/messages/${m.messageId}`, {
        embeds: [card.embed],
        components: card.components,
      });
    }),
  );
}

/** Posts news about a poll (a date was added) as a reply to its post in this
 * channel. Returns false if there's no post to reply to. */
export async function replyToPollMessage(input: {
  channelId: string;
  pollId: string;
  embed: DiscordEmbed;
  content?: string;
  mentionDiscordIds?: string[];
}) {
  const original = await prisma.discordPollMessage.findFirst({
    where: { pollId: input.pollId, channelId: input.channelId },
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

/** The poll id in an in-app link like /campaigns/abc/polls/xyz. */
export function pollIdFromLink(link: string | undefined): string | null {
  return link?.match(/\/polls\/([^/?#]+)$/)?.[1] ?? null;
}

/**
 * The private voting panel one player sees after clicking Vote: two lists,
 * "dates that work" and "dates that might work", with their current answers
 * already picked. Dates in neither list count as No. Null once the poll is
 * closed.
 */
export async function pollVotePanel(pollId: string, memberId: string, notice?: string) {
  const poll = await prisma.datePoll.findUnique({
    where: { id: pollId },
    select: {
      title: true,
      status: true,
      options: {
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, votes: { where: { memberId }, select: { choice: true } } },
      },
    },
  });
  if (!poll || poll.status !== "OPEN") return null;
  const open = poll.options.filter((o) => !isPast(o.startsAt));
  if (open.length === 0) return null;

  const timeZone = getServerTimeZone();
  const answer = (o: (typeof open)[number]) => o.votes[0]?.choice;
  const list = (choice: "YES" | "MAYBE", customId: string, placeholder: string) => ({
    type: 1,
    components: [
      {
        type: 3, // string select
        custom_id: `${customId}:${pollId}`,
        placeholder,
        min_values: 0,
        max_values: open.length,
        options: open.map((o) => ({
          label: formatInTimeZone(o.startsAt, timeZone, "EEEE d MMMM 'at' HH:mm"),
          value: o.id,
          default: answer(o) === choice,
        })),
      },
    ],
  });

  const label = { YES: "Yes", MAYBE: "Maybe", NO: "No", PENDING: "not answered" } as const;
  const summary = open.map((o) => `${at(o.startsAt)}: **${label[answer(o) ?? "PENDING"]}**`).join("\n");
  return {
    content:
      `${notice ? `${notice}\n\n` : ""}**${poll.title || "Find a date for the next session"}**\n` +
      "Pick every date you could make in the first list, and dates that might work in the second. " +
      "Dates in neither count as No. Changes save straight away. None of them work? Suggest another date.\n\n" +
      summary,
    components: [
      list("YES", "pollyes", "Dates that work for me"),
      list("MAYBE", "pollmaybe", "Dates that might work"),
      ...(poll.options.length < MAX_POLL_OPTIONS
        ? [
            {
              type: 1,
              components: [{ type: 2, style: 2, label: "Suggest another date", custom_id: `pollsuggest:${pollId}` }],
            },
          ]
        : []),
    ],
  };
}

/** The start time most of a poll's dates share, as "19:00" in `timeZone`, to
 * pre-fill when suggesting another date. */
export async function usualPollTime(pollId: string, timeZone: string) {
  const options = await prisma.datePollOption.findMany({ where: { pollId }, select: { startsAt: true } });
  const counts = new Map<string, number>();
  for (const o of options) {
    const time = formatInTimeZone(o.startsAt, timeZone, "HH:mm");
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "19:00";
}
