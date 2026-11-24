import "server-only";

import { prisma } from "@/lib/prisma";

// Matches the fallback used everywhere else a session has no duration.
const DEFAULT_DURATION_MINUTES = 180;

/**
 * Marks sessions whose end time has passed as COMPLETED. Run lazily from
 * page loads, like ensureUpcomingProposals, since there's no background job.
 * Unconfirmed proposals count too: once the evening has gone by, "proposed"
 * no longer means anything — a session that didn't happen should have been
 * cancelled beforehand.
 */
export async function completePastSessions(campaignIds: string[]) {
  if (campaignIds.length === 0) return;
  const now = Date.now();

  const started = await prisma.sessionProposal.findMany({
    where: {
      campaignId: { in: campaignIds },
      status: { in: ["PROPOSED", "CONFIRMED"] },
      startsAt: { lt: new Date(now) },
    },
    select: { id: true, startsAt: true, durationMinutes: true },
  });

  const endedIds = started
    .filter(
      (p) =>
        p.startsAt.getTime() + (p.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000 <= now,
    )
    .map((p) => p.id);
  if (endedIds.length === 0) return;

  await prisma.sessionProposal.updateMany({
    where: { id: { in: endedIds }, status: { in: ["PROPOSED", "CONFIRMED"] } },
    data: { status: "COMPLETED" },
  });
}
