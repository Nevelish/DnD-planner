import "server-only";

import { prisma } from "@/lib/prisma";

/** Where the campaign's most recent real (non-draft, non-cancelled) session
 * was held. Groups usually play in the same place, so new sessions start
 * from this instead of a blank form. */
export async function getLastSessionPlace(campaignId: string) {
  const last = await prisma.sessionProposal.findFirst({
    where: {
      campaignId,
      status: { in: ["PROPOSED", "CONFIRMED", "COMPLETED"] },
      OR: [{ format: { not: null } }, { location: { not: null } }],
    },
    orderBy: { startsAt: "desc" },
    select: { format: true, location: true },
  });
  return { format: last?.format ?? null, location: last?.location ?? null };
}
