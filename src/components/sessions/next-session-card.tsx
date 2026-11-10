import { format } from "date-fns";

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
import type { RsvpStatus, SessionProposalStatus } from "@prisma/client";

type Proposal = {
  id: string;
  title: string | null;
  startsAt: Date;
  durationMinutes: number | null;
  status: SessionProposalStatus;
  rsvps: {
    id: string;
    status: RsvpStatus;
    cancellationReason: string | null;
    member: { id: string; user: { id: string; name: string | null; email: string | null } };
  }[];
} | null;

export function NextSessionCard({
  campaignId,
  proposal,
  currentMemberId,
  isDM,
}: {
  campaignId: string;
  proposal: Proposal;
  currentMemberId: string;
  isDM: boolean;
}) {
  if (!proposal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Next session</CardTitle>
          <CardDescription>No upcoming session has been proposed yet.</CardDescription>
        </CardHeader>
        {isDM && (
          <CardContent className="pb-6">
            <ProposeSessionDialog campaignId={campaignId} mode="create" />
          </CardContent>
        )}
      </Card>
    );
  }

  const myRsvp = proposal.rsvps.find((r) => r.member.id === currentMemberId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{proposal.title || "Next session"}</CardTitle>
            <CardDescription>
              {format(proposal.startsAt, "EEEE, MMMM d 'at' h:mm a")}
              {proposal.durationMinutes ? ` · ${proposal.durationMinutes} min` : ""}
            </CardDescription>
          </div>
          <CardAction>
            <Badge variant={proposal.status === "CONFIRMED" ? "success" : "secondary"}>
              {proposal.status === "CONFIRMED" ? "Confirmed" : "Proposed"}
            </Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-6">
        {!isDM && (
          <RsvpButtonGroup
            campaignId={campaignId}
            proposalId={proposal.id}
            currentStatus={myRsvp?.status ?? "PENDING"}
          />
        )}

        {isDM && (
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
  );
}
