import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { ensureUpcomingProposals } from "@/lib/recurring";
import { CampaignCalendar } from "@/components/calendar/campaign-calendar";

export default async function CalendarPage() {
  const userId = await requireUserId();

  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    select: { campaignId: true, role: true },
  });

  await Promise.all(
    memberships
      .filter((m) => m.role === "DM")
      .map((m) => ensureUpcomingProposals(m.campaignId)),
  );

  const campaignIds = memberships.map((m) => m.campaignId);

  const proposals = await prisma.sessionProposal.findMany({
    where: {
      campaignId: { in: campaignIds },
      status: { in: ["PROPOSED", "CONFIRMED"] },
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
    status: p.status as "PROPOSED" | "CONFIRMED",
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Calendar</h1>
      <CampaignCalendar sessions={sessions} />
    </div>
  );
}
