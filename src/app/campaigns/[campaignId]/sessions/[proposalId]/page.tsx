import { notFound } from "next/navigation";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
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
  const { membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const proposal = await prisma.sessionProposal.findUnique({
    where: { id: proposalId, campaignId },
    include: {
      rsvps: { include: { member: { include: { user: true } } } },
    },
  });
  if (!proposal) notFound();

  const myRsvp = proposal.rsvps.find((r) => r.member.id === membership.id);
  const isActive = proposal.status === "PROPOSED" || proposal.status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{proposal.title || "Session"}</CardTitle>
              <CardDescription>
                {format(proposal.startsAt, "EEEE, MMMM d 'at' h:mm a")}
                {proposal.durationMinutes ? ` · ${proposal.durationMinutes} min` : ""}
              </CardDescription>
            </div>
            <CardAction>
              <Badge variant={statusVariant[proposal.status]}>{proposal.status}</Badge>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6">
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
    </div>
  );
}
