import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { ensureUpcomingProposals } from "@/lib/recurring";
import { ensureCalendarToken } from "@/lib/calendarToken";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { getDateTimePrefs, weekStartsOnForUser } from "@/lib/sessionDateFormat";
import { CampaignCalendar, type CalendarSession } from "@/components/calendar/campaign-calendar";
import { AwayDatesCard } from "@/components/calendar/away-dates-card";
import { dayOf, groupToday } from "@/lib/away";
import { formatDayRange } from "@/lib/awayDays";
import { completePastSessions } from "@/lib/completeSessions";
import { SubscribeCalendarBox } from "@/components/calendar/subscribe-calendar-box";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CalendarPage() {
  const userId = await requireUserId();

  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    select: { campaignId: true, role: true },
  });

  const campaignIds = memberships.map((m) => m.campaignId);

  const [, , calendarToken, origin, prefs] = await Promise.all([
    Promise.all(
      memberships
        .filter((m) => m.role === "DM")
        .map((m) => ensureUpcomingProposals(m.campaignId)),
    ),
    completePastSessions(campaignIds),
    ensureCalendarToken(userId),
    getRequestOrigin(),
    getDateTimePrefs(userId),
  ]);

  const proposals = await prisma.sessionProposal.findMany({
    where: {
      campaignId: { in: campaignIds },
      status: { in: ["PROPOSED", "CONFIRMED", "COMPLETED"] },
    },
    include: { campaign: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });

  // Your own away dates, and those of everyone you play with. Ones that ended
  // a while ago are left out; the calendar rarely goes back that far.
  const today = groupToday();
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - 90);
  const awayPeriods = await prisma.awayPeriod.findMany({
    where: {
      endsOn: { gte: since },
      OR: [{ userId }, { user: { memberships: { some: { campaignId: { in: campaignIds } } } } }],
    },
    select: { id: true, userId: true, startsOn: true, endsOn: true, note: true, user: { select: { name: true, email: true } } },
    orderBy: { startsOn: "asc" },
  });
  const away = awayPeriods.map((p) => {
    const mine = p.userId === userId;
    const who = mine ? "You're away" : `${p.user.name ?? p.user.email ?? "Someone"} away`;
    return {
      key: p.id,
      title: p.note ? `${who}: ${p.note}` : who,
      startsOn: dayOf(p.startsOn),
      endsOn: dayOf(p.endsOn),
      mine,
    };
  });
  const myUpcoming = away
    .filter((a) => a.mine && a.endsOn >= today)
    .map((a) => ({
      id: a.key,
      label: formatDayRange(a.startsOn, a.endsOn, { monthFirst: prefs.dateFormat === "MDY" }),
      note: awayPeriods.find((p) => p.id === a.key)?.note ?? null,
    }));

  const sessions = proposals.map((p) => ({
    id: p.id,
    campaignId: p.campaignId,
    campaignName: p.campaign.name,
    title: p.title,
    startsAt: p.startsAt.toISOString(),
    durationMinutes: p.durationMinutes,
    status: p.status as CalendarSession["status"],
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight">Calendar</h1>

      <div className="mb-6 flex flex-col gap-6">
        <CampaignCalendar sessions={sessions} away={away} weekStartsOn={weekStartsOnForUser(prefs)} />

        <AwayDatesCard periods={myUpcoming} today={today} />

        <Card>
          <CardHeader>
            <CardTitle>Subscribe in Outlook, Google, or Apple Calendar</CardTitle>
            <CardDescription>
              A private link that stays in sync as sessions change — nothing
              to re-export.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <SubscribeCalendarBox token={calendarToken} origin={origin} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
