import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildICSFeed, type ICSEvent } from "@/lib/ics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, name: true },
  });
  if (!user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const memberships = await prisma.campaignMember.findMany({
    where: { userId: user.id },
    select: { campaignId: true },
  });
  const campaignIds = memberships.map((m) => m.campaignId);

  const proposals = await prisma.sessionProposal.findMany({
    where: {
      campaignId: { in: campaignIds },
      status: { in: ["PROPOSED", "CONFIRMED"] },
    },
    include: { campaign: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });

  const origin = request.nextUrl.origin;

  const events: ICSEvent[] = proposals.map((p) => {
    const startsAt = p.startsAt;
    const endsAt = new Date(
      startsAt.getTime() + (p.durationMinutes ?? 180) * 60_000,
    );
    return {
      uid: p.id,
      summary: `${p.title || "Session"} — ${p.campaign.name}`,
      startsAt,
      endsAt,
      status: p.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE",
      url: `${origin}/campaigns/${p.campaignId}/sessions/${p.id}`,
    };
  });

  const ics = buildICSFeed(`${user.name ?? "DnD Planner"} — Sessions`, events);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="dnd-planner.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
