import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(input: {
  recipientId: string;
  campaignId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  return prisma.notification.create({ data: input });
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

  if (members.length === 0) return;

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
