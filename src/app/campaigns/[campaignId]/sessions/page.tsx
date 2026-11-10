import Link from "next/link";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProposeSessionDialog } from "@/components/sessions/propose-session-dialog";

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
  const { membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const proposals = await prisma.sessionProposal.findMany({
    where: { campaignId, status: isDM ? undefined : { not: "DRAFT" } },
    orderBy: { startsAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sessions</h2>
        {isDM && <ProposeSessionDialog campaignId={campaignId} mode="create" />}
      </div>

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
                      {p.title || format(p.startsAt, "MMMM d, yyyy")}
                    </CardTitle>
                    <CardDescription>
                      {format(p.startsAt, "EEEE, MMMM d 'at' h:mm a")}
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
