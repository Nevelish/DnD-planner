"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM, requireMember } from "@/lib/permissions";
import {
  addPollOptionSchema,
  createPollSchema,
  pollVoteSchema,
} from "@/lib/validations/poll";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTime } from "@/lib/sessionDateFormat";
import { reminderSentAtFor } from "@/lib/sessionReminders";
import { getLastSessionPlace } from "@/lib/lastSessionPlace";
import { placeSuffix } from "@/lib/sessionPlace";
import { UserError } from "@/lib/userError";
import { refreshPollMessages } from "@/lib/discord/pollPosts";
import { addPollDate } from "@/lib/pollOptions";

/** After any change to a poll: refresh its pages, and the Discord bot's
 * posts about it (counts, the best date, or which date was picked). */
function revalidatePoll(campaignId: string, pollId: string) {
  revalidatePath(`/campaigns/${campaignId}/polls/${pollId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath(`/campaigns/${campaignId}`);
  void refreshPollMessages(pollId);
}

export async function createPoll(campaignId: string, formData: FormData) {
  const dm = await requireDM(campaignId);

  const parsed = createPollSchema.safeParse({
    title: formData.get("title"),
    durationMinutes: formData.get("durationMinutes"),
    options: formData.getAll("options"),
  });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { title, durationMinutes, options } = parsed.data;

  const poll = await prisma.datePoll.create({
    data: {
      campaignId,
      createdById: dm.userId,
      title,
      durationMinutes,
      options: {
        create: [...options]
          .sort((a, b) => a.getTime() - b.getTime())
          .map((startsAt) => ({ startsAt })),
      },
    },
  });

  await notifyCampaignMembers(campaignId, {
    type: "DATE_POLL_OPENED",
    title: "Which date works for you?",
    body: `${options.length} dates to vote on${title ? ` — ${title}` : ""}`,
    link: `/campaigns/${campaignId}/polls/${poll.id}`,
    excludeUserId: dm.userId,
  });

  revalidatePoll(campaignId, poll.id);
  return { pollId: poll.id };
}

export async function votePoll(
  campaignId: string,
  pollId: string,
  optionId: string,
  choice: "YES" | "MAYBE" | "NO",
) {
  const membership = await requireMember(campaignId);
  if (membership.role === "DM") {
    throw new UserError("Only players vote — the dates on offer are the ones you can make.");
  }

  const parsed = pollVoteSchema.safeParse({ choice });
  if (!parsed.success) {
    throw new UserError("Pick Yes, Maybe or No.");
  }

  const option = await prisma.datePollOption.findFirst({
    where: { id: optionId, poll: { id: pollId, campaignId } },
    select: { poll: { select: { status: true } } },
  });
  if (!option) {
    throw new UserError("That date isn't part of this poll.");
  }
  if (option.poll.status !== "OPEN") {
    throw new UserError("This poll is closed.");
  }

  await prisma.datePollVote.upsert({
    where: { optionId_memberId: { optionId, memberId: membership.id } },
    create: { optionId, memberId: membership.id, choice: parsed.data.choice },
    update: { choice: parsed.data.choice },
  });

  revalidatePoll(campaignId, pollId);
}

/**
 * Picks the winning date: turns it into an ordinary proposed session and
 * pre-fills each player's RSVP from their vote on that date, so nobody has
 * to answer the same question twice.
 */
export async function decidePoll(campaignId: string, pollId: string, optionId: string) {
  const dm = await requireDM(campaignId);

  const poll = await prisma.datePoll.findFirst({
    where: { id: pollId, campaignId },
    include: { options: { where: { id: optionId }, include: { votes: true } } },
  });
  const option = poll?.options[0];
  if (!poll || !option) {
    throw new UserError("That date isn't part of this poll.");
  }
  if (option.startsAt.getTime() <= Date.now()) {
    throw new UserError("That date has already passed — pick a later one.");
  }

  const players = await prisma.campaignMember.findMany({
    where: { campaignId, role: "PLAYER" },
    select: { id: true },
  });
  const voteByMember = new Map(option.votes.map((v) => [v.memberId, v.choice]));
  const place = await getLastSessionPlace(campaignId);

  const session = await prisma.$transaction(async (tx) => {
    // Claim the poll first so a double-click can't create two sessions.
    const { count } = await tx.datePoll.updateMany({
      where: { id: pollId, status: "OPEN" },
      data: { status: "DECIDED" },
    });
    if (count === 0) {
      throw new UserError("This poll has already been decided or cancelled.");
    }

    const session = await tx.sessionProposal.create({
      data: {
        campaignId,
        proposedById: dm.userId,
        title: poll.title,
        startsAt: option.startsAt,
        durationMinutes: poll.durationMinutes,
        ...place,
        status: "PROPOSED",
        reminderSentAt: reminderSentAtFor(option.startsAt),
      },
    });
    if (players.length > 0) {
      await tx.rsvp.createMany({
        data: players.map((p) => {
          const vote = voteByMember.get(p.id);
          return {
            sessionProposalId: session.id,
            memberId: p.id,
            status: vote ?? "PENDING",
            respondedAt: vote ? new Date() : null,
          };
        }),
      });
    }
    await tx.datePoll.update({
      where: { id: pollId },
      data: { sessionProposalId: session.id },
    });
    return session;
  });

  await notifyCampaignMembers(campaignId, {
    type: "SESSION_PROPOSED",
    title: "Date picked for the next session",
    body: `${await formatSessionDateTime(session.startsAt)}${placeSuffix(session.format, session.location)}${session.title ? ` — ${session.title}` : ""}`,
    link: `/campaigns/${campaignId}/sessions/${session.id}`,
    excludeUserId: dm.userId,
  });

  revalidatePoll(campaignId, pollId);
  revalidatePath(`/campaigns/${campaignId}/sessions/${session.id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { sessionId: session.id };
}

export async function cancelPoll(campaignId: string, pollId: string) {
  await requireDM(campaignId);
  await prisma.datePoll.updateMany({
    where: { id: pollId, campaignId, status: "OPEN" },
    data: { status: "CANCELLED" },
  });
  revalidatePoll(campaignId, pollId);
}

/** Adds a date to an open poll from the site (see addPollDate). */
export async function addPollOption(campaignId: string, pollId: string, formData: FormData) {
  const membership = await requireMember(campaignId);

  const parsed = addPollOptionSchema.safeParse({ startsAt: formData.get("startsAt") });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Pick a valid date and time.");
  }
  await addPollDate({ campaignId, pollId, membership, startsAt: parsed.data.startsAt });
  revalidatePoll(campaignId, pollId);
}

/** Removes a date from an open poll: the DM can remove any, anyone else
 * only a date they added. Its votes go with it. */
export async function removePollOption(campaignId: string, pollId: string, optionId: string) {
  const membership = await requireMember(campaignId);

  const option = await prisma.datePollOption.findFirst({
    where: { id: optionId, poll: { id: pollId, campaignId } },
    select: {
      addedById: true,
      poll: { select: { status: true, _count: { select: { options: true } } } },
    },
  });
  if (!option) {
    throw new UserError("That date isn't part of this poll.");
  }
  if (option.poll.status !== "OPEN") {
    throw new UserError("This poll is closed.");
  }
  if (membership.role !== "DM" && option.addedById !== membership.userId) {
    throw new UserError("You can only remove dates you added.");
  }
  if (option.poll._count.options <= 2) {
    throw new UserError("A poll needs at least two dates. Cancel the poll instead.");
  }

  await prisma.datePollOption.delete({ where: { id: optionId } });
  revalidatePoll(campaignId, pollId);
}
