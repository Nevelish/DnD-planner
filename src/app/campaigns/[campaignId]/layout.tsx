import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { TabNav } from "@/components/layout/tab-nav";

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { membership } = await requireMembershipForPage(campaignId);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  if (!campaign) notFound();

  const isDM = membership.role === "DM";

  const tabs = [
    { href: `/campaigns/${campaignId}`, label: "Overview" },
    { href: `/campaigns/${campaignId}/sessions`, label: "Sessions" },
    { href: `/campaigns/${campaignId}/roster`, label: "Roster" },
    ...(isDM ? [{ href: `/campaigns/${campaignId}/notes`, label: "Notes" }] : []),
    { href: `/campaigns/${campaignId}/members`, label: "Members" },
    ...(isDM
      ? [{ href: `/campaigns/${campaignId}/settings`, label: "Settings" }]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <Badge variant={isDM ? "default" : "secondary"}>
          {isDM ? "DM" : "Player"}
        </Badge>
      </div>
      <TabNav tabs={tabs} />
      {children}
    </div>
  );
}
