import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { completePastSessions } from "@/lib/completeSessions";
import { formatSessionDateTimeForUser, getDateTimePrefs } from "@/lib/sessionDateFormat";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RsvpButtonGroup } from "@/components/sessions/rsvp-button-group";
import { RsvpList } from "@/components/sessions/rsvp-list";
import { ProposeSessionDialog } from "@/components/sessions/propose-session-dialog";
import { ConfirmProposalButton } from "@/components/sessions/confirm-proposal-button";
import { CancelProposalButton } from "@/components/sessions/cancel-proposal-button";
import { SessionPlace } from "@/components/sessions/session-place";
import { RecapSection } from "@/components/sessions/recap-section";

const statusVariant = {
  DRAFT: "secondary",
  PROPOSED: "secondary",
  CONFIRMED: "success",
  CANCELLED: "destructive",
  COMPLETED: "outline",
} as const;

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string; proposalId: string }>;
}) {
  const { campaignId, proposalId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  await completePastSessions([campaignId]);

  const [proposal, prefs] = await Promise.all([
    prisma.sessionProposal.findUnique({
      where: { id: proposalId, campaignId },
      include: {
        rsvps: { include: { member: { include: { user: true } } } },
        recapAuthor: { select: { name: true, email: true } },
      },
    }),
    getDateTimePrefs(userId),
  ]);
  if (!proposal) notFound();

  const myRsvp = proposal.rsvps.find((r) => r.member.id === membership.id);
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const currentUserName = me.name ?? me.email ?? "you";
  const isActive = proposal.status === "PROPOSED" || proposal.status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{proposal.title || "Session"}</CardTitle>
              <CardDescription>
                {formatSessionDateTimeForUser(proposal.startsAt, prefs)}
                {proposal.durationMinutes ? ` · ${proposal.durationMinutes} min` : ""}
              </CardDescription>
            </div>
            <CardAction>
              <Badge variant={statusVariant[proposal.status]}>{proposal.status}</Badge>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6">
          <SessionPlace
            format={proposal.format}
            location={proposal.location}
            description={proposal.description}
          />

          {proposal.status === "CANCELLED" && proposal.cancelReason && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Cancelled: &ldquo;{proposal.cancelReason}&rdquo;
            </p>
          )}

          {!isDM && isActive && (
            <RsvpButtonGroup
              campaignId={campaignId}
              proposalId={proposal.id}
              currentStatus={myRsvp?.status ?? "PENDING"}
            />
          )}

          {isDM && isActive && (
            <div className="flex flex-wrap gap-2">
              <ProposeSessionDialog
                campaignId={campaignId}
                proposalId={proposal.id}
                mode="edit"
                defaultValues={proposal}
                trigger={
                  <button className="text-sm font-medium underline underline-offset-2">
                    Edit
                  </button>
                }
              />
              {proposal.status !== "CONFIRMED" && (
                <ConfirmProposalButton campaignId={campaignId} proposalId={proposal.id} />
              )}
              <CancelProposalButton campaignId={campaignId} proposalId={proposal.id} />
            </div>
          )}

          <RsvpList rsvps={proposal.rsvps} />
        </CardContent>
      </Card>

      {proposal.status === "COMPLETED" && (
        <Card>
          <CardHeader>
            <CardTitle>Recap</CardTitle>
            <CardDescription>What happened this session, for the campaign log.</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <RecapSection
              campaignId={campaignId}
              proposalId={proposal.id}
              initialContent={proposal.recap}
              initialUpdatedAt={proposal.recapUpdatedAt?.toISOString() ?? null}
              initialAuthorName={proposal.recapAuthor?.name ?? proposal.recapAuthor?.email ?? null}
              currentUserName={currentUserName}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
