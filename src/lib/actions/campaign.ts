"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/prisma";
import { requireUserId, requireDM, requireMember } from "@/lib/permissions";
import { campaignSchema, discordWebhookSettingsSchema } from "@/lib/validations/campaign";
import { createNotification } from "@/lib/notifications";
import { postToDiscordWebhook } from "@/lib/discordWebhook";
import { UserError } from "@/lib/userError";
import { addPlayerToCampaign, recordRemoval } from "@/lib/membership";

export async function createCampaign(formData: FormData) {
  const userId = await requireUserId();
  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
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
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
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
    throw new UserError("Only the campaign owner can delete this campaign.");
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
    throw new UserError("That invite link is invalid or has expired.");
  }

  await addPlayerToCampaign(campaign.id, userId);

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
    throw new UserError(
      "The DM can't leave their own campaign — delete it instead.",
    );
  }

  await prisma.campaignMember.delete({ where: { id: membership.id } });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  await createNotification({
    recipientId: campaign.ownerId,
    campaignId: campaign.id,
    type: "MEMBER_LEFT",
    title: `${user.name ?? user.email} left ${campaign.name}`,
    link: `/campaigns/${campaign.id}/members`,
  });

  revalidatePath("/campaigns");
}

/** The DM removes a player. They stay out (no rejoining by invite link or
 * from Discord) until the DM allows them back. */
export async function removeMember(campaignId: string, memberId: string) {
  const dm = await requireDM(campaignId);
  if (dm.id === memberId) {
    throw new UserError("The DM can't remove themselves from the campaign.");
  }

  const member = await prisma.campaignMember.findFirst({
    where: { id: memberId, campaignId },
    select: { userId: true },
  });
  if (!member) throw new UserError("They're not in this campaign any more.");
  await prisma.campaignMember.delete({ where: { id: memberId } });
  await recordRemoval(campaignId, member.userId);
  revalidatePath(`/campaigns/${campaignId}/members`);
}

/** Lets someone the DM removed join again (they still need to rejoin). */
export async function allowBackIntoCampaign(campaignId: string, removalId: string) {
  await requireDM(campaignId);
  const { count } = await prisma.campaignRemoval.deleteMany({ where: { id: removalId, campaignId } });
  if (count === 0) throw new UserError("They can already rejoin.");
  revalidatePath(`/campaigns/${campaignId}/members`);
}

export async function updateCampaignDiscordWebhook(campaignId: string, formData: FormData) {
  await requireDM(campaignId);

  const parsed = discordWebhookSettingsSchema.safeParse({
    discordWebhookUrl: formData.get("discordWebhookUrl"),
    discordWebhookEvents: formData.getAll("discordWebhookEvents"),
  });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
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
    throw new UserError("Add a webhook URL and save it first.");
  }

  const ok = await postToDiscordWebhook(campaign.discordWebhookUrl, {
    title: "Test notification",
    body: `This is what ${campaign.name}'s notifications will look like here.`,
  });
  if (!ok) {
    throw new UserError("Discord rejected that webhook URL. Double-check it was copied correctly.");
  }
}
