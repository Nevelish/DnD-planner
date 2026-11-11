import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { JoinByCodeDialog } from "@/components/campaigns/join-by-code-dialog";

export default async function CampaignsPage() {
  const userId = await requireUserId();
  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    include: { campaign: true },
    orderBy: { campaign: { updatedAt: "desc" } },
  });

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Your campaigns</h1>
        <div className="flex gap-2">
          <JoinByCodeDialog />
          <Button asChild>
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        </div>
      </div>
      {memberships.length === 0 ? (
        <p className="text-muted-foreground">
          You&apos;re not in any campaigns yet. Create one, or ask a DM for an
          invite link.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => (
            <CampaignCard key={m.campaign.id} campaign={m.campaign} role={m.role} />
          ))}
        </div>
      )}
    </div>
  );
}
