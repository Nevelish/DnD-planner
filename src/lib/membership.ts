import "server-only";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { UserError } from "@/lib/userError";

const REMOVED_MESSAGE = "The DM removed you from this campaign. Ask them if you'd like to rejoin.";

/**
 * Whether the DM removed this person from the campaign (and hasn't allowed
 * them back). Matched by account, and by Discord account: the one linked
 * to the account, or `discordId` for someone clicking in Discord who may
 * not have an account yet.
 */
export async function isRemovedFromCampaign(
  campaignId: string,
  who: { userId?: string; discordId?: string },
) {
  const discordIds = new Set<string>(who.discordId ? [who.discordId] : []);
  if (who.userId) {
    const linked = await prisma.account.findMany({
      where: { userId: who.userId, provider: "discord" },
      select: { providerAccountId: true },
    });
    for (const a of linked) discordIds.add(a.providerAccountId);
  }
  const or = [
    ...(who.userId ? [{ userId: who.userId }] : []),
    ...(discordIds.size ? [{ discordId: { in: [...discordIds] } }] : []),
  ];
  if (or.length === 0) return false;
  return (await prisma.campaignRemoval.count({ where: { campaignId, OR: or } })) > 0;
}

/** Remembers that the DM removed someone, so they can't simply rejoin. */
export async function recordRemoval(campaignId: string, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, accounts: { where: { provider: "discord" }, select: { providerAccountId: true } } },
  });
  const data = {
    name: user.name ?? user.email ?? "Someone",
    discordId: user.accounts[0]?.providerAccountId ?? null,
    removedAt: new Date(),
  };
  await prisma.campaignRemoval.upsert({
    where: { campaignId_userId: { campaignId, userId } },
    create: { campaignId, userId, ...data },
    update: data,
  });
}

/**
 * Adds someone to a campaign as a player (if they aren't in it already) and
 * tells the DM. Returns their membership. Used by invite links and by the
 * Discord bot. Refuses someone the DM removed.
 */
export async function addPlayerToCampaign(campaignId: string, userId: string) {
  const existing = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  if (existing) return existing;
  if (await isRemovedFromCampaign(campaignId, { userId })) throw new UserError(REMOVED_MESSAGE);

  const [membership, campaign, user] = await Promise.all([
    prisma.campaignMember.create({ data: { campaignId, userId, role: "PLAYER" } }),
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { name: true, ownerId: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } }),
  ]);
  await createNotification({
    recipientId: campaign.ownerId,
    campaignId,
    type: "MEMBER_JOINED",
    title: `${user.name ?? user.email} joined ${campaign.name}`,
    link: `/campaigns/${campaignId}/members`,
  });
  return membership;
}
