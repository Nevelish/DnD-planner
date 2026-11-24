import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { ensureUpcomingProposals } from "@/lib/recurring";
import { completePastSessions } from "@/lib/completeSessions";
import { getDateTimePrefs } from "@/lib/sessionDateFormat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NextSessionCard } from "@/components/sessions/next-session-card";
import { DraftProposalCard } from "@/components/sessions/draft-proposal-card";
import { OpenPollCard } from "@/components/polls/open-poll-card";
import { getOpenPolls } from "@/lib/openPolls";

export default async function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  await Promise.all([
    isDM ? ensureUpcomingProposals(campaignId) : undefined,
    completePastSessions([campaignId]),
  ]);

  const [campaign, memberCount, nextProposal, draftProposal, prefs, { polls, playerCount }] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
    prisma.campaignMember.count({ where: { campaignId } }),
    prisma.sessionProposal.findFirst({
      where: {
        campaignId,
        status: { in: ["PROPOSED", "CONFIRMED"] },
        startsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
      include: { rsvps: { include: { member: { include: { user: true } } } } },
    }),
    isDM
      ? prisma.sessionProposal.findFirst({
          where: { campaignId, status: "DRAFT" },
          orderBy: { startsAt: "asc" },
        })
      : Promise.resolve(null),
    getDateTimePrefs(userId),
    getOpenPolls(campaignId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <CardDescription className="whitespace-pre-wrap text-foreground">
              {campaign.description || "No description yet."}
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>At a glance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pb-6 text-sm">
            <p className="text-muted-foreground">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/campaigns/${campaignId}/members`}>
                View members
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {draftProposal && (
        <DraftProposalCard campaignId={campaignId} proposal={draftProposal} prefs={prefs} />
      )}

      {polls.map((poll) => (
        <OpenPollCard
          key={poll.id}
          campaignId={campaignId}
          poll={poll}
          isDM={isDM}
          currentMemberId={membership.id}
          playerCount={playerCount}
        />
      ))}

      <NextSessionCard
        campaignId={campaignId}
        proposal={nextProposal}
        isDM={isDM}
        currentMemberId={membership.id}
        prefs={prefs}
      />
    </div>
  );
}
