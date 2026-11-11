import Link from "next/link";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { ensureUpcomingProposals } from "@/lib/recurring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const userId = await requireUserId();

  const dmMemberships = await prisma.campaignMember.findMany({
    where: { userId, role: "DM" },
    select: { campaignId: true },
  });
  await Promise.all(
    dmMemberships.map((m) => ensureUpcomingProposals(m.campaignId)),
  );

  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    include: {
      campaign: {
        include: {
          sessionProposals: {
            where: { status: "PROPOSED", startsAt: { gte: new Date() } },
            orderBy: { startsAt: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const dmCampaigns = memberships.filter((m) => m.role === "DM");
  const playerCampaigns = memberships.filter((m) => m.role === "PLAYER");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight">Dashboard</h1>

      {memberships.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>
              Create a campaign to DM, or join one with an invite link from a
              friend.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <Button asChild>
              <Link href="/campaigns/new">Create a campaign</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {dmCampaigns.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Campaigns you DM
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {dmCampaigns.map((m) => (
                  <DashboardCampaignCard key={m.campaign.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {playerCampaigns.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Campaigns you play in
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {playerCampaigns.map((m) => (
                  <DashboardCampaignCard key={m.campaign.id} membership={m} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardCampaignCard({
  membership,
}: {
  membership: {
    role: "DM" | "PLAYER";
    campaign: {
      id: string;
      name: string;
      sessionProposals: { id: string; title: string | null; startsAt: Date }[];
    };
  };
}) {
  const nextSession = membership.campaign.sessionProposals[0];
  return (
    <Link href={`/campaigns/${membership.campaign.id}`}>
      <Card className="h-full py-6 transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{membership.campaign.name}</CardTitle>
            <Badge variant={membership.role === "DM" ? "default" : "secondary"}>
              {membership.role === "DM" ? "DM" : "Player"}
            </Badge>
          </div>
          <CardDescription>
            {nextSession
              ? `Next: ${format(nextSession.startsAt, "MMM d 'at' h:mm a")}`
              : "No upcoming session proposed"}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
