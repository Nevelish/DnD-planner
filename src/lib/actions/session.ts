"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM } from "@/lib/permissions";
import { proposalSchema } from "@/lib/validations/session";
import { notifyCampaignMembers } from "@/lib/notifications";

function parseProposalForm(formData: FormData) {
  const parsed = proposalSchema.safeParse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  return parsed.data;
}

export async function createProposal(campaignId: string, formData: FormData) {
  const dm = await requireDM(campaignId);
  const data = parseProposalForm(formData);

  const players = await prisma.campaignMember.findMany({
    where: { campaignId, role: "PLAYER" },
  });

  const proposal = await prisma.$transaction(async (tx) => {
    const proposal = await tx.sessionProposal.create({
      data: {
        campaignId,
        proposedById: dm.userId,
        title: data.title,
        startsAt: data.startsAt,
        durationMinutes: data.durationMinutes,
        status: "PROPOSED",
      },
    });
    if (players.length > 0) {
      await tx.rsvp.createMany({
        data: players.map((p) => ({
          sessionProposalId: proposal.id,
          memberId: p.id,
          status: "PENDING",
        })),
      });
    }
    return proposal;
  });

  await notifyCampaignMembers(campaignId, {
    type: "SESSION_PROPOSED",
    title: "New session proposed",
    body: proposal.title ?? undefined,
    link: `/campaigns/${campaignId}/sessions/${proposal.id}`,
    excludeUserId: dm.userId,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function publishDraft(
  campaignId: string,
  proposalId: string,
  formData: FormData,
) {
  const dm = await requireDM(campaignId);
  const data = parseProposalForm(formData);

  const players = await prisma.campaignMember.findMany({
    where: { campaignId, role: "PLAYER" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.sessionProposal.update({
      where: { id: proposalId },
      data: {
        title: data.title,
        startsAt: data.startsAt,
        durationMinutes: data.durationMinutes,
        status: "PROPOSED",
      },
    });
    if (players.length > 0) {
      await tx.rsvp.createMany({
        data: players.map((p) => ({
          sessionProposalId: proposalId,
          memberId: p.id,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
    }
  });

  await notifyCampaignMembers(campaignId, {
    type: "SESSION_PROPOSED",
    title: "New session proposed",
    link: `/campaigns/${campaignId}/sessions/${proposalId}`,
    excludeUserId: dm.userId,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function updateProposal(
  campaignId: string,
  proposalId: string,
  formData: FormData,
) {
  await requireDM(campaignId);
  const data = parseProposalForm(formData);

  await prisma.sessionProposal.update({
    where: { id: proposalId },
    data,
  });

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/calendar");
}

export async function confirmProposal(campaignId: string, proposalId: string) {
  await requireDM(campaignId);
  await prisma.sessionProposal.update({
    where: { id: proposalId },
    data: { status: "CONFIRMED" },
  });
  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function cancelProposal(
  campaignId: string,
  proposalId: string,
  reason?: string,
) {
  await requireDM(campaignId);

  await prisma.sessionProposal.update({
    where: { id: proposalId },
    data: { status: "CANCELLED", cancelReason: reason },
  });

  await notifyCampaignMembers(campaignId, {
    type: "SESSION_CANCELLED",
    title: "Session cancelled",
    body: reason,
    link: `/campaigns/${campaignId}/sessions/${proposalId}`,
  });

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
