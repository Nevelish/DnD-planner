import "server-only";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { addPlayerToCampaign } from "@/lib/membership";
import { recordRsvp, rsvpNeedsReason, type RsvpAnswer } from "@/lib/rsvp";
import { UserError } from "@/lib/userError";
import { createJoinToken } from "@/lib/discord/joinLink";

// What Discord sends: https://discord.com/developers/docs/interactions/receiving-and-responding
type DiscordUser = { id: string; username: string; global_name?: string | null };
type ModalRow = { component?: { custom_id?: string; value?: string }; components?: { custom_id?: string; value?: string }[] };
export type Interaction = {
  type: number;
  channel_id?: string;
  guild_id?: string;
  member?: { user: DiscordUser; nick?: string | null };
  user?: DiscordUser;
  data?: {
    name?: string;
    options?: { name: string }[];
    custom_id?: string;
    components?: ModalRow[];
  };
};

const InteractionType = { PING: 1, COMMAND: 2, COMPONENT: 3, MODAL_SUBMIT: 5 } as const;
const Callback = { PONG: 1, MESSAGE: 4, UPDATE_MESSAGE: 7, MODAL: 9 } as const;
const EPHEMERAL = 1 << 6;

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
async function createUserFromDiscord(discordUser: DiscordUser, nick?: string | null) {
  try {
    return await prisma.user.create({
      data: {
        name: nick || discordUser.global_name || discordUser.username,
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
    if (interaction.type === InteractionType.COMMAND && interaction.data?.name === "planner") {
      if (interaction.data.options?.[0]?.name === "connect") return await connectCommand(interaction);
    }
    if (interaction.type === InteractionType.COMPONENT) {
      const [kind, id, status] = customId.split(":");
      if (kind === "rsvp" && (status === "YES" || status === "MAYBE" || status === "NO")) {
        return await rsvpClick(interaction, id, status);
      }
      if (kind === "connect") return await connectClick(interaction, id);
    }
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      const [kind, id] = customId.split(":");
      if (kind === "reason") return await reasonSubmit(interaction, id);
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
    select: { campaign: { select: { id: true, name: true, discordChannelId: true } } },
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
      "I don't know who you are on the planner yet. Sign in there with Discord (or connect Discord on your account page), then try again.",
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
  await prisma.campaign.update({ where: { id: campaign.id }, data: { discordChannelId: interaction.channel_id } });
  return {
    type: Callback.UPDATE_MESSAGE,
    data: {
      content:
        `Done! **${campaign.name}** will post here from now on, and session posts get RSVP buttons. ` +
        "Choose which events get posted, and who can join from Discord, in the campaign's settings on the planner.",
      components: [],
    },
  };
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

  const discordUser = discordUserOf(interaction);
  let user = await plannerUserFor(discordUser.id);
  if (user?.disabled) return privately("Your planner account has been disabled. Ask your admin.");

  let membership = user
    ? await prisma.campaignMember.findUnique({
        where: { campaignId_userId: { campaignId: session.campaignId, userId: user.id } },
      })
    : null;

  let welcome = false;
  if (!membership) {
    // Joining straight from Discord only counts from the campaign's own
    // channel, and only if the DM turned it on.
    const canAutoJoin =
      session.campaign.discordAutoJoin && !!interaction.channel_id && interaction.channel_id === session.campaign.discordChannelId;
    if (!canAutoJoin) {
      const token = createJoinToken({ discordId: discordUser.id, campaignId: session.campaignId, sessionId, status });
      return privately(
        `You're not in **${session.campaign.name}** on the planner yet. Join once with your Discord account and ` +
          "your answer will be saved. After that, these buttons just work.",
        [linkButton("Join and answer", `${await getRequestOrigin()}/discord/join?token=${token}`)],
      );
    }
    user ??= await createUserFromDiscord(discordUser, interaction.member?.nick);
    membership = await addPlayerToCampaign(session.campaignId, user.id);
    welcome = true;
  }

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
  const rows = interaction.data?.components ?? [];
  const reason = rows
    .flatMap((row) => [row.component, ...(row.components ?? [])])
    .find((c) => c?.custom_id === "reason")?.value;

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
