import "server-only";

import { prisma } from "@/lib/prisma";
import type { OpenPollSummary } from "@/components/polls/open-poll-card";

/** A campaign's open date polls (with just enough vote data for the
 * summary card) and its player count. */
export async function getOpenPolls(campaignId: string) {
  const [polls, playerCount] = await Promise.all([
    prisma.datePoll.findMany({
      where: { campaignId, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        options: { select: { votes: { select: { memberId: true } } } },
      },
    }),
    prisma.campaignMember.count({ where: { campaignId, role: "PLAYER" } }),
  ]);
  return { polls: polls satisfies OpenPollSummary[], playerCount };
}
