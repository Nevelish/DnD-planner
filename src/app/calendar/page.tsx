import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { ensureUpcomingProposals } from "@/lib/recurring";
import { ensureCalendarToken } from "@/lib/calendarToken";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { getDateTimePrefs, weekStartsOnForUser } from "@/lib/sessionDateFormat";
import { CampaignCalendar, type CalendarSession } from "@/components/calendar/campaign-calendar";
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
        <CampaignCalendar sessions={sessions} weekStartsOn={weekStartsOnForUser(prefs)} />

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
