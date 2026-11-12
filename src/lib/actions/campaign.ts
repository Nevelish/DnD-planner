"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/prisma";
import { requireUserId, requireDM, requireMember } from "@/lib/permissions";
import { campaignSchema, discordWebhookSettingsSchema } from "@/lib/validations/campaign";
import { createNotification } from "@/lib/notifications";
import { postToDiscordWebhook } from "@/lib/discordWebhook";

export async function createCampaign(formData: FormData) {
  const userId = await requireUserId();
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const campaign = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        ownerId: userId,
        inviteCode: nanoid(10),
      },
    });
    await tx.campaignMember.create({
      data: { campaignId: campaign.id, userId, role: "DM" },
    });
    return campaign;
  });

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  await requireDM(campaignId);
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: parsed.data,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/settings`);
}

export async function deleteCampaign(campaignId: string) {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign || campaign.ownerId !== userId) {
    throw new Error("Only the campaign owner can delete this campaign.");
  }

  await prisma.campaign.delete({ where: { id: campaignId } });
  revalidatePath("/campaigns");
}

export async function regenerateInviteCode(campaignId: string) {
  await requireDM(campaignId);
  const inviteCode = nanoid(10);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { inviteCode },
  });
  revalidatePath(`/campaigns/${campaignId}/members`);
  revalidatePath(`/campaigns/${campaignId}/settings`);
  return inviteCode;
}

export async function joinCampaignByCode(inviteCode: string) {
  const userId = await requireUserId();

  const campaign = await prisma.campaign.findUnique({
    where: { inviteCode },
  });
  if (!campaign) {
    throw new Error("That invite link is invalid or has expired.");
  }

  const existing = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId } },
  });
  if (existing) {
    return { campaignId: campaign.id };
  }

  await prisma.campaignMember.create({
    data: { campaignId: campaign.id, userId, role: "PLAYER" },
  });

  await createNotification({
    recipientId: campaign.ownerId,
    campaignId: campaign.id,
    type: "MEMBER_JOINED",
    title: `A new player joined ${campaign.name}`,
    link: `/campaigns/${campaign.id}/members`,
  });

  revalidatePath(`/campaigns/${campaign.id}`);
  return { campaignId: campaign.id };
}

export async function leaveCampaign(campaignId: string) {
  const userId = await requireUserId();
  const membership = await requireMember(campaignId);

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
  });
  if (campaign.ownerId === userId) {
    throw new Error(
      "The DM can't leave their own campaign — delete it instead.",
    );
  }

  await prisma.campaignMember.delete({ where: { id: membership.id } });

  await createNotification({
    recipientId: campaign.ownerId,
    campaignId: campaign.id,
    type: "MEMBER_LEFT",
    title: `A player left ${campaign.name}`,
    link: `/campaigns/${campaign.id}/members`,
  });

  revalidatePath("/campaigns");
}

export async function removeMember(campaignId: string, memberId: string) {
  const dm = await requireDM(campaignId);
  if (dm.id === memberId) {
    throw new Error("The DM can't remove themselves from the campaign.");
  }

  await prisma.campaignMember.delete({ where: { id: memberId } });
  revalidatePath(`/campaigns/${campaignId}/members`);
}

export async function updateCampaignDiscordWebhook(campaignId: string, formData: FormData) {
  await requireDM(campaignId);

  const parsed = discordWebhookSettingsSchema.safeParse({
    discordWebhookUrl: formData.get("discordWebhookUrl"),
    discordWebhookEvents: formData.getAll("discordWebhookEvents"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      discordWebhookUrl: parsed.data.discordWebhookUrl || null,
      discordWebhookEvents: parsed.data.discordWebhookEvents,
    },
  });

  revalidatePath(`/campaigns/${campaignId}/settings`);
}

export async function testCampaignDiscordWebhook(campaignId: string) {
  await requireDM(campaignId);

  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { name: true, discordWebhookUrl: true },
  });
  if (!campaign.discordWebhookUrl) {
    throw new Error("Add a webhook URL and save it first.");
  }

  const ok = await postToDiscordWebhook(campaign.discordWebhookUrl, {
    title: "Test notification",
    body: `This is what ${campaign.name}'s notifications will look like here.`,
  });
  if (!ok) {
    throw new Error("Discord rejected that webhook URL. Double-check it was copied correctly.");
  }
}
