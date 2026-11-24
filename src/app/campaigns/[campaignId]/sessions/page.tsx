import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { completePastSessions } from "@/lib/completeSessions";
import {
  formatDateOnlyForUser,
  formatSessionDateTimeForUser,
  getDateTimePrefs,
} from "@/lib/sessionDateFormat";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProposeSessionDialog } from "@/components/sessions/propose-session-dialog";
import { CreatePollDialog } from "@/components/polls/create-poll-dialog";
import { OpenPollCard } from "@/components/polls/open-poll-card";
import { getOpenPolls } from "@/lib/openPolls";

const statusVariant = {
  DRAFT: "secondary",
  PROPOSED: "secondary",
  CONFIRMED: "success",
  CANCELLED: "destructive",
  COMPLETED: "outline",
} as const;

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  await completePastSessions([campaignId]);

  const [proposals, prefs, { polls, playerCount }] = await Promise.all([
    prisma.sessionProposal.findMany({
      where: { campaignId, status: isDM ? undefined : { not: "DRAFT" } },
      orderBy: { startsAt: "desc" },
    }),
    getDateTimePrefs(userId),
    getOpenPolls(campaignId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Sessions</h2>
        {isDM && (
          <div className="flex flex-wrap gap-2">
            <CreatePollDialog campaignId={campaignId} />
            <ProposeSessionDialog campaignId={campaignId} mode="create" />
          </div>
        )}
      </div>

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

      {proposals.length === 0 ? (
        <p className="text-muted-foreground">No sessions yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {proposals.map((p) => (
            <Link key={p.id} href={`/campaigns/${campaignId}/sessions/${p.id}`}>
              <Card className="py-4 transition-colors hover:border-primary/50">
                <CardHeader className="flex-row items-center justify-between gap-2 px-4 pt-0">
                  <div>
                    <CardTitle className="text-base">
                      {p.title || formatDateOnlyForUser(p.startsAt, prefs)}
                    </CardTitle>
                    <CardDescription>
                      {formatSessionDateTimeForUser(p.startsAt, prefs)}
                    </CardDescription>
                  </div>
                  <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
