"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/permissions";
import { rsvpSchema } from "@/lib/validations/session";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTime } from "@/lib/sessionDateFormat";

export async function respond(
  campaignId: string,
  proposalId: string,
  status: "YES" | "NO",
  reason?: string,
) {
  const membership = await requireMember(campaignId);

  const parsed = rsvpSchema.safeParse({ status, reason });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const [existing, proposal] = await Promise.all([
    prisma.rsvp.findUnique({
      where: {
        sessionProposalId_memberId: {
          sessionProposalId: proposalId,
          memberId: membership.id,
        },
      },
    }),
    prisma.sessionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: { startsAt: true },
    }),
  ]);

  const isCancellation = existing?.status === "YES" && parsed.data.status === "NO";
  if (isCancellation && !parsed.data.reason) {
    throw new Error(
      "Let the group know why, so they can decide whether to still run it.",
    );
  }

  const rsvp = await prisma.rsvp.upsert({
    where: {
      sessionProposalId_memberId: {
        sessionProposalId: proposalId,
        memberId: membership.id,
      },
    },
    create: {
      sessionProposalId: proposalId,
      memberId: membership.id,
      status: parsed.data.status,
      cancellationReason: parsed.data.status === "NO" ? parsed.data.reason : undefined,
      respondedAt: new Date(),
    },
    update: {
      status: parsed.data.status,
      cancellationReason: parsed.data.status === "NO" ? (parsed.data.reason ?? null) : null,
      respondedAt: new Date(),
    },
  });

  await notifyCampaignMembers(campaignId, {
    type: "RSVP_CHANGED",
    title: isCancellation
      ? "A player can no longer make the next session"
      : "RSVP updated",
    body: `${formatSessionDateTime(proposal.startsAt)}${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}`,
    link: `/campaigns/${campaignId}/sessions/${proposalId}`,
    excludeUserId: membership.userId,
  });

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);

  return rsvp;
}
