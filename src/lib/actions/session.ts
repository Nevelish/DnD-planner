"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM } from "@/lib/permissions";
import { proposalSchema } from "@/lib/validations/session";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTime } from "@/lib/sessionDateFormat";
import { reminderSentAtFor } from "@/lib/sessionReminders";
import { describePlace, placeSuffix } from "@/lib/sessionPlace";

function parseProposalForm(formData: FormData) {
  const parsed = proposalSchema.safeParse({
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    format: formData.get("format"),
    location: formData.get("location"),
    description: formData.get("description"),
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
        ...data,
        status: "PROPOSED",
        reminderSentAt: reminderSentAtFor(data.startsAt),
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
    body: `${await formatSessionDateTime(proposal.startsAt)}${placeSuffix(proposal.format, proposal.location)}${proposal.title ? ` — ${proposal.title}` : ""}`,
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
      where: { id: proposalId, campaignId },
      data: {
        ...data,
        status: "PROPOSED",
        reminderSentAt: reminderSentAtFor(data.startsAt),
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
    body: `${await formatSessionDateTime(data.startsAt)}${placeSuffix(data.format, data.location)}${data.title ? ` — ${data.title}` : ""}`,
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
  const dm = await requireDM(campaignId);
  const data = parseProposalForm(formData);

  const before = await prisma.sessionProposal.findUniqueOrThrow({
    where: { id: proposalId, campaignId },
  });
  const moved = before.startsAt.getTime() !== data.startsAt.getTime();
  const placeChanged =
    before.format !== data.format || before.location !== data.location;
  const updated = await prisma.sessionProposal.update({
    where: { id: proposalId, campaignId },
    // A new start time re-arms the reminder for the new date.
    data: moved ? { ...data, reminderSentAt: reminderSentAtFor(data.startsAt) } : data,
  });

  // Drafts haven't been sent to players yet, and a title-, end-time- or
  // description-only edit doesn't change anyone's plans — a new start time
  // or a new place (e.g. moving the game online) is news.
  if (before.status !== "DRAFT" && (moved || placeChanged)) {
    const when = moved
      ? `${await formatSessionDateTime(before.startsAt)} → ${await formatSessionDateTime(updated.startsAt)}`
      : await formatSessionDateTime(updated.startsAt);
    const place = describePlace(updated.format, updated.location);
    const where = place ? ` · ${place}` : placeChanged ? " · location to be announced" : "";
    await notifyCampaignMembers(campaignId, {
      type: "SESSION_RESCHEDULED",
      title:
        moved && placeChanged
          ? "Session time and location changed"
          : moved
            ? "Session time changed"
            : "Session location changed",
      body: `${when}${where}${updated.title ? ` — ${updated.title}` : ""}`,
      link: `/campaigns/${campaignId}/sessions/${proposalId}`,
      excludeUserId: dm.userId,
    });
  }

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function confirmProposal(campaignId: string, proposalId: string) {
  const dm = await requireDM(campaignId);

  // Only a still-proposed session can be confirmed; a count of 0 means it
  // was already confirmed (e.g. a double-click), so don't notify twice.
  const { count } = await prisma.sessionProposal.updateMany({
    where: { id: proposalId, campaignId, status: "PROPOSED" },
    data: { status: "CONFIRMED" },
  });

  if (count > 0) {
    const confirmed = await prisma.sessionProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    await notifyCampaignMembers(campaignId, {
      type: "SESSION_CONFIRMED",
      title: "Session confirmed",
      body: `${await formatSessionDateTime(confirmed.startsAt)}${confirmed.title ? ` — ${confirmed.title}` : ""}`,
      link: `/campaigns/${campaignId}/sessions/${proposalId}`,
      excludeUserId: dm.userId,
    });
  }

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function cancelProposal(
  campaignId: string,
  proposalId: string,
  reason?: string,
) {
  await requireDM(campaignId);

  const cancelled = await prisma.sessionProposal.update({
    where: { id: proposalId, campaignId },
    data: { status: "CANCELLED", cancelReason: reason },
  });

  await notifyCampaignMembers(campaignId, {
    type: "SESSION_CANCELLED",
    title: "Session cancelled",
    body: `${await formatSessionDateTime(cancelled.startsAt)}${reason ? ` — ${reason}` : ""}`,
    link: `/campaigns/${campaignId}/sessions/${proposalId}`,
  });

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
