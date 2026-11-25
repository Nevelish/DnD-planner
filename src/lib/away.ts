import "server-only";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { getServerTimeZone } from "@/lib/timezone";
import type { AwayRange } from "@/lib/awayDays";

/** The calendar day a moment falls on for the group ("YYYY-MM-DD"), in the
 * server's timezone, which is the one away dates are meant in. */
export function groupDay(date: Date): string {
  return formatInTimeZone(date, getServerTimeZone(), "yyyy-MM-dd");
}

export function groupToday(): string {
  return groupDay(new Date());
}

/** A DATE column comes back as midnight UTC on that day. */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type MemberAway = AwayRange & { userId: string };

/** Away periods of everyone in a campaign that haven't ended yet. */
export async function loadCampaignAway(campaignId: string): Promise<MemberAway[]> {
  const periods = await prisma.awayPeriod.findMany({
    where: {
      endsOn: { gte: new Date(groupToday()) },
      user: { memberships: { some: { campaignId } } },
    },
    select: { userId: true, startsOn: true, endsOn: true, note: true, user: { select: { name: true, email: true } } },
    orderBy: { startsOn: "asc" },
  });
  return periods.map((p) => ({
    userId: p.userId,
    name: p.user.name ?? p.user.email ?? "Someone",
    startsOn: dayOf(p.startsOn),
    endsOn: dayOf(p.endsOn),
    note: p.note,
  }));
}

/** Drops the user ids, for passing to client components. */
export function toAwayRanges(away: MemberAway[]): AwayRange[] {
  return away.map(({ name, startsOn, endsOn, note }) => ({ name, startsOn, endsOn, note }));
}
