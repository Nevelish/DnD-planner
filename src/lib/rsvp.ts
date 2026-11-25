import "server-only";

import { prisma } from "@/lib/prisma";
import { rsvpSchema } from "@/lib/validations/session";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTime } from "@/lib/sessionDateFormat";
import { UserError } from "@/lib/userError";

const RSVP_LABEL = { YES: "Yes", MAYBE: "Maybe", NO: "No" } as const;
const RSVP_COLOR = { YES: 0x57a64a, MAYBE: 0xe0a33a, NO: 0xd9534f } as const;

export type RsvpAnswer = "YES" | "MAYBE" | "NO";

/** Whether changing to `status` needs a reason: backing out after a Yes. */
export async function rsvpNeedsReason(proposalId: string, memberId: string, status: RsvpAnswer) {
  if (status !== "NO") return false;
  const existing = await prisma.rsvp.findUnique({
    where: { sessionProposalId_memberId: { sessionProposalId: proposalId, memberId } },
    select: { status: true },
  });
  return existing?.status === "YES";
}

/**
 * Records one player's answer for a session, and tells the rest of the
 * campaign. Shared by the site and the Discord buttons, so both follow the
 * same rules. Throws a UserError when the answer isn't allowed.
 */
export async function recordRsvp(input: {
  campaignId: string;
  proposalId: string;
  membership: { id: string; userId: string };
  status: RsvpAnswer;
  reason?: string;
}) {
  const { campaignId, proposalId, membership } = input;
  const parsed = rsvpSchema.safeParse({ status: input.status, reason: input.reason });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const [existing, proposal, user] = await Promise.all([
    prisma.rsvp.findUnique({
      where: { sessionProposalId_memberId: { sessionProposalId: proposalId, memberId: membership.id } },
    }),
    prisma.sessionProposal.findUnique({
      where: { id: proposalId, campaignId },
      select: { startsAt: true, status: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: membership.userId },
      select: { name: true, email: true },
    }),
  ]);
  if (!proposal) {
    throw new UserError("That session doesn't exist any more.");
  }
  if (proposal.status !== "PROPOSED" && proposal.status !== "CONFIRMED") {
    throw new UserError("This session is no longer open for RSVPs.");
  }

  const isCancellation = existing?.status === "YES" && parsed.data.status === "NO";
  if (isCancellation && !parsed.data.reason) {
    throw new UserError("Let the group know why, so they can decide whether to still run it.");
  }

  const rsvp = await prisma.rsvp.upsert({
    where: { sessionProposalId_memberId: { sessionProposalId: proposalId, memberId: membership.id } },
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

  const playerName = user.name ?? user.email;
  const newStatus = parsed.data.status;
  const title = isCancellation
    ? `${playerName} can no longer make it`
    : existing?.status === "YES" && newStatus === "MAYBE"
      ? `${playerName} might not make it after all`
      : `${playerName} RSVP'd ${RSVP_LABEL[newStatus]}`;
  // Also brings the bot's Discord posts about this session up to date.
  await notifyCampaignMembers(campaignId, {
    type: "RSVP_CHANGED",
    title,
    body: `${await formatSessionDateTime(proposal.startsAt)}${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}`,
    link: `/campaigns/${campaignId}/sessions/${proposalId}`,
    excludeUserId: membership.userId,
    color: RSVP_COLOR[newStatus],
  });

  return rsvp;
}
