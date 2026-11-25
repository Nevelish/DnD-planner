import "server-only";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

/**
 * Adds someone to a campaign as a player (if they aren't in it already) and
 * tells the DM. Returns their membership. Used by invite links and by the
 * Discord bot.
 */
export async function addPlayerToCampaign(campaignId: string, userId: string) {
  const existing = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  if (existing) return existing;

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
