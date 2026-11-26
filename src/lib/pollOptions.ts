import "server-only";

import { prisma } from "@/lib/prisma";
import { MAX_POLL_OPTIONS } from "@/lib/validations/poll";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTime } from "@/lib/sessionDateFormat";
import { UserError } from "@/lib/userError";

/**
 * Adds a date to an open poll — for when none of the DM's dates work. Anyone
 * in the campaign can add one. A player who adds a date can obviously make
 * it, so they're counted as a Yes straight away; everyone who has already
 * voted (and the DM) is told, so the new date isn't left looking unpopular
 * just because nobody has seen it yet. Shared by the site and Discord.
 */
export async function addPollDate(input: {
  campaignId: string;
  pollId: string;
  membership: { id: string; userId: string; role: "DM" | "PLAYER" };
  startsAt: Date;
}) {
  const { campaignId, pollId, membership, startsAt } = input;
  if (Number.isNaN(startsAt.getTime())) throw new UserError("Pick a valid date and time.");
  if (startsAt.getTime() <= Date.now()) throw new UserError("Pick a date in the future.");

  const poll = await prisma.datePoll.findFirst({
    where: { id: pollId, campaignId },
    select: {
      status: true,
      title: true,
      createdById: true,
      options: { select: { startsAt: true, votes: { select: { memberId: true } } } },
    },
  });
  if (!poll) {
    throw new UserError("Poll not found.");
  }
  if (poll.status !== "OPEN") {
    throw new UserError("This poll is closed.");
  }
  if (poll.options.some((o) => o.startsAt.getTime() === startsAt.getTime())) {
    throw new UserError("That date is already in the poll.");
  }
  if (poll.options.length >= MAX_POLL_OPTIONS) {
    throw new UserError(`This poll already has the maximum of ${MAX_POLL_OPTIONS} dates.`);
  }

  try {
    await prisma.datePollOption.create({
      data: {
        pollId,
        startsAt,
        addedById: membership.userId,
        // Only players vote; the DM's dates are by definition ones they can make.
        ...(membership.role === "PLAYER"
          ? { votes: { create: { memberId: membership.id, choice: "YES" } } }
          : {}),
      },
    });
  } catch (e) {
    // Two people adding the same date at once: the unique index catches it.
    if ((e as { code?: string }).code === "P2002") {
      throw new UserError("That date is already in the poll.");
    }
    throw e;
  }

  const voterMemberIds = new Set(poll.options.flatMap((o) => o.votes.map((v) => v.memberId)));
  const voters = await prisma.campaignMember.findMany({
    where: { id: { in: [...voterMemberIds] } },
    select: { userId: true },
  });
  const recipients = new Set([...voters.map((v) => v.userId), poll.createdById]);
  recipients.delete(membership.userId);

  if (recipients.size > 0) {
    await notifyCampaignMembers(campaignId, {
      type: "DATE_POLL_OPENED",
      title: "New date added to the poll",
      body: `${await formatSessionDateTime(startsAt)}${poll.title ? ` — ${poll.title}` : ""}`,
      link: `/campaigns/${campaignId}/polls/${pollId}`,
      onlyUserIds: [...recipients],
    });
  }
}
