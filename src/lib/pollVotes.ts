import "server-only";

import { prisma } from "@/lib/prisma";
import { isPast } from "@/lib/pollResults";
import { UserError } from "@/lib/userError";

/**
 * Saves one player's answers from one of the two lists in the Discord voting
 * panel: the dates picked in the list get that answer, and every other date
 * still open ends up answered too. A date dropped from the list becomes No,
 * and so does a date not answered yet, while a date answered from the
 * other list keeps that answer.
 */
export async function saveVotesFromList(input: {
  pollId: string;
  memberId: string;
  choice: "YES" | "MAYBE";
  optionIds: string[];
}) {
  const poll = await prisma.datePoll.findUnique({
    where: { id: input.pollId },
    select: {
      status: true,
      options: {
        select: { id: true, startsAt: true, votes: { where: { memberId: input.memberId }, select: { choice: true } } },
      },
    },
  });
  if (!poll) throw new UserError("That poll doesn't exist any more.");
  if (poll.status !== "OPEN") throw new UserError("This poll is closed.");

  const picked = new Set(input.optionIds);
  const changes = poll.options
    .filter((o) => !isPast(o.startsAt))
    .map((o) => {
      const current = o.votes[0]?.choice;
      const next = picked.has(o.id) ? input.choice : current && current !== input.choice ? current : "NO";
      return { optionId: o.id, current, next };
    })
    .filter((c) => c.current !== c.next);

  await prisma.$transaction(
    changes.map(({ optionId, next }) =>
      prisma.datePollVote.upsert({
        where: { optionId_memberId: { optionId, memberId: input.memberId } },
        create: { optionId, memberId: input.memberId, choice: next },
        update: { choice: next },
      }),
    ),
  );
}
