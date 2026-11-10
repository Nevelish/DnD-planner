import Link from "next/link";
import type { Campaign, CampaignRole } from "@prisma/client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CampaignCard({
  campaign,
  role,
}: {
  campaign: Campaign;
  role: CampaignRole;
}) {
  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="h-full py-6 transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge variant={role === "DM" ? "default" : "secondary"}>
              {role === "DM" ? "DM" : "Player"}
            </Badge>
          </div>
          {campaign.description && (
            <CardDescription className="line-clamp-2">
              {campaign.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}
