import "server-only";
import { Prisma, type NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { addPlayerToCampaign, isRemovedFromCampaign } from "@/lib/membership";
import { recordRsvp, rsvpNeedsReason, type RsvpAnswer } from "@/lib/rsvp";
import { UserError } from "@/lib/userError";
import { createJoinToken, type JoinTarget } from "@/lib/discord/joinLink";
import {
  pollMessage,
  pollVoteButtonId,
  pollVotePanel,
  postPollMessage,
  refreshPollMessages,
  usualPollTime,
} from "@/lib/discord/pollPosts";
import { postSessionMessage, sessionMessage } from "@/lib/discord/sessionPosts";
import { groupDay, loadCampaignAway } from "@/lib/away";
import { awayOn } from "@/lib/awayDays";
import { addPollDate } from "@/lib/pollOptions";
import { readDateAndTime } from "@/lib/dateInput";
import { getServerTimeZone } from "@/lib/timezone";
import { saveVotesFromList } from "@/lib/pollVotes";

// What Discord sends: https://discord.com/developers/docs/interactions/receiving-and-responding
type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };
type ModalRow = { component?: { custom_id?: string; value?: string }; components?: { custom_id?: string; value?: string }[] };
type CommandOption = { name: string; type?: number; value?: unknown; options?: CommandOption[] };
export type Interaction = {
  type: number;
  channel_id?: string;
  guild_id?: string;
  member?: { user: DiscordUser; nick?: string | null };
  user?: DiscordUser;
  data?: {
    name?: string;
    options?: CommandOption[];
    custom_id?: string;
    values?: string[]; // what was picked in a dropdown
    components?: ModalRow[];
  };
};

const InteractionType = { PING: 1, COMMAND: 2, COMPONENT: 3, MODAL_SUBMIT: 5 } as const;
const Callback = { PONG: 1, MESSAGE: 4, UPDATE_MESSAGE: 7, MODAL: 9 } as const;
const EPHEMERAL = 1 << 6;

/** Events that stop being posted when a campaign connects the bot: the
 * session post shows answers itself, and the rest is chatter for a game
 * channel. Everyone still gets them in the app, and the DM can switch any
 * back on in the campaign's settings. */
const QUIET_WITH_BOT: NotificationType[] = ["RSVP_CHANGED", "MEMBER_JOINED", "MEMBER_LEFT", "RECURRING_DRAFT_READY"];

const LABEL: Record<RsvpAnswer, string> = { YES: "I'm in", MAYBE: "Maybe", NO: "Can't make it" };

/** A reply only the person who clicked can see. */
function privately(content: string, components?: unknown[]) {
  return {
    type: Callback.MESSAGE,
    data: { content, flags: EPHEMERAL, components, allowed_mentions: { parse: [] } },
  };
}

const linkButton = (label: string, url: string) => ({
  type: 1,
  components: [{ type: 2, style: 5, label, url }],
});

/** Discord renders <t:…> in each reader's own timezone and language. */
const when = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

/** The planner account linked to a Discord account (by "Sign in with
 * Discord", or created by the bot). Typed-in Discord ids on the account
 * page aren't enough: anyone could type anyone's id. */
async function plannerUserFor(discordId: string) {
  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "discord", providerAccountId: discordId } },
    select: { user: { select: { id: true, disabled: true } } },
  });
  return account?.user ?? null;
}

/** For campaigns that allow it: an account made straight from Discord. If
 * they sign in with Discord later, they land in this same account. */
/** Their Discord profile picture, as Discord serves it, if they have one. */
function discordAvatarUrl(user: DiscordUser) {
  return user.avatar && /^(a_)?[0-9a-f]+$/.test(user.avatar)
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
    : null;
}

async function createUserFromDiscord(discordUser: DiscordUser, nick?: string | null) {
  try {
    return await prisma.user.create({
      data: {
        name: nick || discordUser.global_name || discordUser.username,
        image: discordAvatarUrl(discordUser),
        discordUserId: discordUser.id,
        accounts: { create: { type: "oauth", provider: "discord", providerAccountId: discordUser.id } },
      },
      select: { id: true, disabled: true },
    });
  } catch (e) {
    // Two clicks at once: the other one made it.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return (await plannerUserFor(discordUser.id))!;
    }
    throw e;
  }
}

export async function handleInteraction(interaction: Interaction): Promise<unknown> {
  try {
    if (interaction.type === InteractionType.PING) return { type: Callback.PONG };

    const customId = interaction.data?.custom_id ?? "";
    if (interaction.type === InteractionType.COMMAND) {
      const command = interaction.data?.name;
      if (command === "next") return await nextCommand(interaction);
      if (command === "poll") return await pollCommand(interaction);
      if (command === "planner") {
        const sub = interaction.data?.options?.[0]?.name;
        if (sub === "connect") return await connectCommand(interaction);
        if (sub === "nudge") return await nudgeCommand(interaction);
      }
    }
    if (interaction.type === InteractionType.COMPONENT) {
      const [kind, id, status] = customId.split(":");
      if (kind === "rsvp" && (status === "YES" || status === "MAYBE" || status === "NO")) {
        return await rsvpClick(interaction, id, status);
      }
      if (kind === "connect") return await connectClick(interaction, id);
      if (kind === "pollvote") return await pollVoteClick(interaction, id);
      if (kind === "pollsuggest") return await pollSuggestClick(interaction, id);
      if (kind === "pollyes" || kind === "pollmaybe") {
        return await pollListChange(interaction, id, kind === "pollyes" ? "YES" : "MAYBE");
      }
    }
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      const [kind, id] = customId.split(":");
      if (kind === "reason") return await reasonSubmit(interaction, id);
      if (kind === "pollsuggestform") return await pollSuggestSubmit(interaction, id);
    }
    return privately("Sorry, I don't know what to do with that.");
  } catch (e) {
    if (e instanceof UserError) return privately(e.message);
    console.error("Discord interaction failed:", e);
    return privately("Something went wrong on the planner's side. Try again, or answer on the website.");
  }
}

function discordUserOf(interaction: Interaction): DiscordUser {
  const user = interaction.member?.user ?? interaction.user;
  if (!user) throw new UserError("Discord didn't say who you are.");
  return user;
}

// ---------- /planner connect ----------

async function dmCampaignsOf(discordId: string) {
  const user = await plannerUserFor(discordId);
  if (!user || user.disabled) return null;
  return prisma.campaignMember.findMany({
    where: { userId: user.id, role: "DM" },
    select: { campaign: { select: { id: true, name: true, discordChannelId: true, discordWebhookEvents: true } } },
    orderBy: { joinedAt: "asc" },
    take: 25,
  });
}

async function connectCommand(interaction: Interaction) {
  if (!interaction.guild_id || !interaction.channel_id) {
    return privately("Run this in the server channel you want the sessions posted in.");
  }
  const memberships = await dmCampaignsOf(discordUserOf(interaction).id);
  if (memberships === null) {
    return privately(
      "I don't know who you are on the planner yet. Open your Account page there and click **Connect Discord** " +
        "(you can keep signing in with your email), then try again.",
      [linkButton("Open the planner", `${await getRequestOrigin()}/account`)],
    );
  }
  if (memberships.length === 0) {
    return privately("Only a campaign's DM can connect it to a channel, and you're not the DM of any campaign.");
  }
  const buttons = memberships.map(({ campaign }) => ({
    type: 2,
    style: campaign.discordChannelId === interaction.channel_id ? 2 : 1,
    label: `${campaign.name}${campaign.discordChannelId === interaction.channel_id ? " (connected here)" : ""}`.slice(0, 80),
    custom_id: `connect:${campaign.id}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
  return privately("Which campaign should post its sessions in this channel?", rows);
}

async function connectClick(interaction: Interaction, campaignId: string) {
  const memberships = (await dmCampaignsOf(discordUserOf(interaction).id)) ?? [];
  const campaign = memberships.find((m) => m.campaign.id === campaignId)?.campaign;
  if (!campaign || !interaction.channel_id) {
    return { type: Callback.UPDATE_MESSAGE, data: { content: "Only the campaign's DM can do that.", components: [] } };
  }
  const firstConnect = !campaign.discordChannelId;
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      discordChannelId: interaction.channel_id,
      // Moving to another channel keeps whatever the DM has chosen since.
      ...(firstConnect
        ? { discordWebhookEvents: campaign.discordWebhookEvents.filter((t) => !QUIET_WITH_BOT.includes(t)) }
        : {}),
    },
  });
  return {
    type: Callback.UPDATE_MESSAGE,
    data: {
      content:
        `Done! **${campaign.name}** will post here from now on. Session posts get RSVP buttons and keep ` +
        "track of who's coming, and updates to a session are posted as replies to it. Choose which events get " +
        "posted, and who can join from Discord, in the campaign's settings on the planner.",
      components: [],
    },
  };
}

/** A text box's value from a submitted pop-up: inside a Label (the current
 * format) or an action row (the older one). */
function modalValue(interaction: Interaction, customId: string) {
  return (interaction.data?.components ?? [])
    .flatMap((row) => [row.component, ...(row.components ?? [])])
    .find((c) => c?.custom_id === customId)?.value;
}

// ---------- Who clicked ----------

type CampaignForClick = { id: string; name: string; discordAutoJoin: boolean; discordChannelId: string | null };

/**
 * The campaign membership of whoever clicked a button. Someone who isn't in
 * the campaign yet either joins on the spot (if the DM allows that, and only
 * from the campaign's own channel) or gets a private link to join with their
 * Discord account; then `response` is the reply to send instead.
 */
async function memberForClick(
  interaction: Interaction,
  campaign: CampaignForClick,
  link: {
    join: JoinTarget;
    joinText: string;
    joinButton: string;
  },
): Promise<
  | { membership: { id: string; userId: string; role: "DM" | "PLAYER" }; welcome: boolean }
  | { response: unknown }
> {
  const discordUser = discordUserOf(interaction);
  let user = await plannerUserFor(discordUser.id);
  if (user?.disabled) return { response: privately("Your planner account has been disabled. Ask your admin.") };
  if (await isRemovedFromCampaign(campaign.id, { userId: user?.id, discordId: discordUser.id })) {
    return {
      response: privately(`The DM removed you from **${campaign.name}**. Ask them if you'd like to rejoin.`),
    };
  }

  // Discord-made accounts from before pictures were copied get theirs now.
  // Only accounts with no picture and no password: never one someone chose.
  const avatar = discordAvatarUrl(discordUser);
  if (user && avatar) {
    await prisma.user.updateMany({
      where: { id: user.id, image: null, passwordHash: null, avatarUpdatedAt: null },
      data: { image: avatar },
    });
  }

  const membership = user
    ? await prisma.campaignMember.findUnique({
        where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
      })
    : null;
  if (membership) return { membership, welcome: false };

  const canAutoJoin =
    campaign.discordAutoJoin && !!interaction.channel_id && interaction.channel_id === campaign.discordChannelId;
  if (!canAutoJoin) {
    const token = createJoinToken({ discordId: discordUser.id, campaignId: campaign.id, ...link.join });
    return {
      response: privately(
        `You're not in **${campaign.name}** on the planner yet. Join once with your Discord account and ` +
          `${link.joinText}. After that, these buttons just work.`,
        [linkButton(link.joinButton, `${await getRequestOrigin()}/discord/join?token=${token}`)],
      ),
    };
  }
  user ??= await createUserFromDiscord(discordUser, interaction.member?.nick);
  return { membership: await addPlayerToCampaign(campaign.id, user.id), welcome: true };
}

// ---------- RSVP buttons ----------

async function rsvpClick(interaction: Interaction, sessionId: string, status: RsvpAnswer) {
  const session = await prisma.sessionProposal.findUnique({
    where: { id: sessionId },
    select: {
      title: true,
      startsAt: true,
      campaignId: true,
      campaign: { select: { name: true, discordAutoJoin: true, discordChannelId: true } },
    },
  });
  if (!session) return privately("That session doesn't exist any more.");

  const who = await memberForClick(interaction, { id: session.campaignId, ...session.campaign }, {
    join: { sessionId, status },
    joinText: "your answer will be saved",
    joinButton: "Join and answer",
  });
  if ("response" in who) return who.response;
  const { membership, welcome } = who;

  if (membership.role === "DM") return privately("You're the DM of this one, so there's nothing to RSVP.");

  if (await rsvpNeedsReason(sessionId, membership.id, status)) {
    return {
      type: Callback.MODAL,
      data: {
        custom_id: `reason:${sessionId}`,
        title: "Can't make it after all?",
        components: [
          {
            type: 18, // label
            label: "Let the group know why",
            description: "So they can decide whether to still run it.",
            component: { type: 4, custom_id: "reason", style: 2, max_length: 500, required: true },
          },
        ],
      },
    };
  }

  await recordRsvp({ campaignId: session.campaignId, proposalId: sessionId, membership, status });
  const what = `**${session.title || "the session"}** on ${when(session.startsAt)}`;
  return privately(
    `${welcome ? `Welcome to **${session.campaign.name}**! ` : ""}You're down as **${LABEL[status]}** for ${what}.`,
  );
}

async function reasonSubmit(interaction: Interaction, sessionId: string) {
  const reason = modalValue(interaction, "reason");

  const session = await prisma.sessionProposal.findUnique({
    where: { id: sessionId },
    select: { title: true, startsAt: true, campaignId: true },
  });
  const user = await plannerUserFor(discordUserOf(interaction).id);
  const membership =
    session && user && !user.disabled
      ? await prisma.campaignMember.findUnique({
          where: { campaignId_userId: { campaignId: session.campaignId, userId: user.id } },
        })
      : null;
  if (!session || !membership) return privately("I couldn't save that. Try answering on the website.");

  await recordRsvp({ campaignId: session.campaignId, proposalId: sessionId, membership, status: "NO", reason });
  return privately(`Thanks for letting everyone know. You're down as **Can't make it** for **${session.title || "the session"}**.`);
}

// ---------- Date polls ----------

/** The poll's Vote button: opens the private voting panel. */
async function pollVoteClick(interaction: Interaction, pollId: string) {
  const poll = await prisma.datePoll.findUnique({
    where: { id: pollId },
    select: { campaignId: true, campaign: { select: { name: true, discordAutoJoin: true, discordChannelId: true } } },
  });
  if (!poll) return privately("That poll doesn't exist any more.");

  const who = await memberForClick(interaction, { id: poll.campaignId, ...poll.campaign }, {
    join: { pollId },
    joinText: "you can vote on the dates",
    joinButton: "Join and vote",
  });
  if ("response" in who) return who.response;
  if (who.membership.role === "DM") {
    return privately("You're the DM of this one: players vote, and you pick the date on the planner.");
  }

  const welcome = who.welcome ? `Welcome to **${poll.campaign.name}**!` : undefined;
  const panel = await pollVotePanel(pollId, who.membership.id, welcome);
  if (!panel) return privately("This poll is closed.");
  return privately(panel.content, panel.components);
}

/** A change in one of the panel's two lists: saved straight away. */
async function pollListChange(interaction: Interaction, pollId: string, choice: "YES" | "MAYBE") {
  const poll = await prisma.datePoll.findUnique({ where: { id: pollId }, select: { campaignId: true } });
  const user = await plannerUserFor(discordUserOf(interaction).id);
  const membership =
    poll && user && !user.disabled
      ? await prisma.campaignMember.findUnique({
          where: { campaignId_userId: { campaignId: poll.campaignId, userId: user.id } },
        })
      : null;
  if (!poll || !membership || membership.role !== "PLAYER") {
    return { type: Callback.UPDATE_MESSAGE, data: { content: "I couldn't save that. Try voting on the website.", components: [] } };
  }

  await saveVotesFromList({ pollId, memberId: membership.id, choice, optionIds: interaction.data?.values ?? [] });
  void refreshPollMessages(pollId);
  const panel = await pollVotePanel(pollId, membership.id, "Saved.");
  if (!panel) return { type: Callback.UPDATE_MESSAGE, data: { content: "This poll is closed.", components: [] } };
  return { type: Callback.UPDATE_MESSAGE, data: { content: panel.content, components: panel.components } };
}

/** The player (not the DM) behind a click on a poll they're in, or null. */
async function pollPlayer(interaction: Interaction, pollId: string) {
  const poll = await prisma.datePoll.findUnique({ where: { id: pollId }, select: { campaignId: true } });
  const user = await plannerUserFor(discordUserOf(interaction).id);
  const membership =
    poll && user && !user.disabled
      ? await prisma.campaignMember.findUnique({
          where: { campaignId_userId: { campaignId: poll.campaignId, userId: user.id } },
        })
      : null;
  return poll && membership?.role === "PLAYER" ? { campaignId: poll.campaignId, membership } : null;
}

/** "Suggest another date" in the voting panel: a pop-up for the date and
 * time, the time filled in with the poll's usual start. */
async function pollSuggestClick(interaction: Interaction, pollId: string) {
  if (!(await pollPlayer(interaction, pollId))) return privately("I couldn't do that. Try suggesting the date on the website.");
  const timeZone = getServerTimeZone();
  const box = (customId: string, label: string, description: string, extra: object) => ({
    type: 18, // label
    label,
    description,
    component: { type: 4, custom_id: customId, style: 1, required: true, max_length: 40, ...extra },
  });
  return {
    type: Callback.MODAL,
    data: {
      custom_id: `pollsuggestform:${pollId}`,
      title: "Suggest another date",
      components: [
        box("date", "Date", "Day first, like 26.12 or 26.12.2027", { placeholder: "26.12" }),
        box("time", "Start time", `24-hour clock, ${timeZone.replace(/_/g, " ")} time`, {
          value: await usualPollTime(pollId, timeZone),
        }),
      ],
    },
  };
}

/** The suggested date from the pop-up: added like on the site (counting the
 * suggester as a Yes), and the panel shows it. */
async function pollSuggestSubmit(interaction: Interaction, pollId: string) {
  const player = await pollPlayer(interaction, pollId);
  if (!player) return privately("I couldn't do that. Try suggesting the date on the website.");

  const timeZone = getServerTimeZone();
  const read = readDateAndTime(modalValue(interaction, "date") ?? "", modalValue(interaction, "time") ?? "", timeZone);
  let notice: string;
  if ("error" in read) {
    notice = `Couldn't add that date: ${read.error}`;
  } else {
    try {
      await addPollDate({ campaignId: player.campaignId, pollId, membership: player.membership, startsAt: read.date });
      void refreshPollMessages(pollId);
      notice = `Added <t:${Math.floor(read.date.getTime() / 1000)}:F>, and you're marked as a Yes for it.`;
    } catch (e) {
      if (!(e instanceof UserError)) throw e;
      notice = `Couldn't add that date: ${e.message}`;
    }
  }
  const panel = await pollVotePanel(pollId, player.membership.id, notice);
  if (!panel) return { type: Callback.UPDATE_MESSAGE, data: { content: notice, components: [] } };
  return { type: Callback.UPDATE_MESSAGE, data: { content: panel.content, components: panel.components } };
}

// ---------- /next, /poll, /planner nudge ----------

const NOT_CONNECTED = "This channel isn't connected to a campaign. The DM can connect it with `/planner connect`.";

/** The campaign whose posts go to this channel (preferring one the person
 * is in, should two campaigns share a channel). */
async function campaignForChannel(interaction: Interaction) {
  if (!interaction.channel_id) return null;
  const campaigns = await prisma.campaign.findMany({
    where: { discordChannelId: interaction.channel_id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (campaigns.length <= 1) return campaigns[0] ?? null;
  const user = await plannerUserFor(discordUserOf(interaction).id);
  const mine = user
    ? await prisma.campaignMember.findFirst({
        where: { userId: user.id, campaignId: { in: campaigns.map((c) => c.id) } },
        select: { campaignId: true },
      })
    : null;
  return campaigns.find((c) => c.id === mine?.campaignId) ?? campaigns[0];
}

const wantsToShare = (interaction: Interaction) =>
  interaction.data?.options?.some((o) => o.name === "share" && o.value === true) ?? false;

const nextSessionOf = (campaignId: string) =>
  prisma.sessionProposal.findFirst({
    where: { campaignId, status: { in: ["PROPOSED", "CONFIRMED"] }, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });

const openPollOf = (campaignId: string) =>
  prisma.datePoll.findFirst({
    where: { campaignId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

/** /next: the next session, privately, with RSVP buttons. With `share`,
 * posted to the channel as a post that keeps itself up to date. */
async function nextCommand(interaction: Interaction) {
  const campaign = await campaignForChannel(interaction);
  if (!campaign) return privately(NOT_CONNECTED);
  const session = await nextSessionOf(campaign.id);
  if (!session) {
    const poll = await openPollOf(campaign.id);
    return privately(
      `No session is planned for **${campaign.name}** yet.` +
        (poll ? " There's a date poll open, though: `/poll` brings it up." : ""),
    );
  }

  const announcement = {
    title: "Next session",
    url: `${await getRequestOrigin()}/campaigns/${campaign.id}/sessions/${session.id}`,
  };
  if (wantsToShare(interaction)) {
    void postSessionMessage({ channelId: interaction.channel_id!, sessionId: session.id, embed: announcement });
    return privately("Posted it in the channel.");
  }
  const message = await sessionMessage(session.id, announcement);
  if (!message) return privately("That session doesn't exist any more.");
  return { type: Callback.MESSAGE, data: { ...message, flags: EPHEMERAL, allowed_mentions: { parse: [] } } };
}

/** /poll: the open date poll, privately, with its Vote button. With
 * `share`, posted to the channel as a post that keeps itself up to date. */
async function pollCommand(interaction: Interaction) {
  const campaign = await campaignForChannel(interaction);
  if (!campaign) return privately(NOT_CONNECTED);
  const poll = await openPollOf(campaign.id);
  if (!poll) return privately(`There's no date poll open for **${campaign.name}** right now.`);

  const announcement = {
    title: "Which date works for you?",
    url: `${await getRequestOrigin()}/campaigns/${campaign.id}/polls/${poll.id}`,
  };
  if (wantsToShare(interaction)) {
    void postPollMessage({ channelId: interaction.channel_id!, pollId: poll.id, embed: announcement });
    return privately("Posted it in the channel.");
  }
  const message = await pollMessage(poll.id, announcement);
  if (!message) return privately("That poll doesn't exist any more.");
  return { type: Callback.MESSAGE, data: { ...message, flags: EPHEMERAL, allowed_mentions: { parse: [] } } };
}

/**
 * /planner nudge (DM only): a message in the channel that @mentions only
 * the players who haven't answered the next session (leaving out anyone
 * away that day) or haven't voted in the open poll, with the buttons to
 * answer right there.
 */
async function nudgeCommand(interaction: Interaction) {
  const campaign = await campaignForChannel(interaction);
  if (!campaign) return privately(NOT_CONNECTED);
  const user = await plannerUserFor(discordUserOf(interaction).id);
  const dm =
    user && !user.disabled
      ? await prisma.campaignMember.findFirst({ where: { campaignId: campaign.id, userId: user.id, role: "DM" } })
      : null;
  if (!dm) return privately("Only the campaign's DM can nudge players.");

  const [players, session, poll] = await Promise.all([
    prisma.campaignMember.findMany({
      where: { campaignId: campaign.id, role: "PLAYER" },
      orderBy: { joinedAt: "asc" },
      select: { id: true, userId: true, user: { select: { name: true, email: true, discordUserId: true } } },
    }),
    nextSessionOf(campaign.id),
    openPollOf(campaign.id),
  ]);
  const nameOf = (p: (typeof players)[number]) => p.user.name ?? p.user.email ?? "Someone";

  let sessionWaiting: typeof players = [];
  if (session) {
    const answered = new Set(
      (
        await prisma.rsvp.findMany({
          where: { sessionProposalId: session.id, status: { not: "PENDING" } },
          select: { memberId: true },
        })
      ).map((r) => r.memberId),
    );
    const away = new Set(awayOn(await loadCampaignAway(campaign.id), groupDay(session.startsAt)).map((a) => a.userId));
    sessionWaiting = players.filter((p) => !answered.has(p.id) && !away.has(p.userId));
  }
  let pollWaiting: typeof players = [];
  if (poll) {
    const voted = new Set(
      (
        await prisma.datePollVote.findMany({ where: { option: { pollId: poll.id } }, select: { memberId: true } })
      ).map((v) => v.memberId),
    );
    pollWaiting = players.filter((p) => !voted.has(p.id));
  }
  if (!session && !poll) return privately("There's no upcoming session or open poll to nudge about.");
  if (sessionWaiting.length === 0 && pollWaiting.length === 0) {
    return privately("Everyone has answered. Nothing to nudge.");
  }

  const origin = await getRequestOrigin();
  const lines: string[] = [];
  const components: unknown[] = [];
  if (session && sessionWaiting.length) {
    lines.push(
      `**${session.title || "Next session"}**, ${when(session.startsAt)}`,
      `Not answered yet: ${sessionWaiting.map(nameOf).join(", ")}`,
    );
    const message = await sessionMessage(session.id, {
      title: "Next session",
      url: `${origin}/campaigns/${campaign.id}/sessions/${session.id}`,
    });
    components.push(...(message?.components ?? []));
  }
  if (poll && pollWaiting.length) {
    if (lines.length) lines.push("");
    lines.push(`**Date poll: ${poll.title || "Find a date for the next session"}**`, `Not voted yet: ${pollWaiting.map(nameOf).join(", ")}`);
    components.push({
      type: 1,
      components: [{ type: 2, style: 1, label: "Vote on dates", custom_id: pollVoteButtonId(poll.id) }],
    });
  }

  const nudged = [...new Set([...sessionWaiting, ...pollWaiting].map((p) => p.user.discordUserId).filter((id): id is string => !!id))];
  return {
    type: Callback.MESSAGE,
    data: {
      content: `${nudged.map((id) => `<@${id}>`).join(" ")}${nudged.length ? " " : ""}The DM is waiting for your answer:`,
      embeds: [{ title: "Still waiting on you", description: lines.join("\n"), color: 0xe0a33a, footer: { text: campaign.name } }],
      components,
      allowed_mentions: { parse: [], users: nudged },
    },
  };
}
