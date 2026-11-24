import type { SessionFormat } from "@prisma/client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProposeSessionDialog } from "@/components/sessions/propose-session-dialog";
import { proposalDefaults } from "@/lib/proposalDefaults";
import { formatSessionDateTimeForUser, type DateTimePrefs } from "@/lib/sessionDateFormat";

export function DraftProposalCard({
  campaignId,
  proposal,
  prefs,
}: {
  campaignId: string;
  proposal: {
    id: string;
    title: string | null;
    startsAt: Date;
    durationMinutes: number | null;
    format: SessionFormat | null;
    location: string | null;
    description: string | null;
  };
  prefs: DateTimePrefs;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Draft session ready</CardTitle>
        <CardDescription>
          Your recurring schedule suggests{" "}
          {formatSessionDateTimeForUser(proposal.startsAt, prefs)}. Review and send it to
          the party.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <ProposeSessionDialog
          campaignId={campaignId}
          proposalId={proposal.id}
          mode="publish"
          defaultValues={proposalDefaults(proposal)}
          trigger={<button className="text-sm font-medium underline underline-offset-2">Review &amp; propose</button>}
        />
      </CardContent>
    </Card>
  );
}
