import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinCampaignButton } from "@/components/campaigns/join-campaign-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  const campaign = await prisma.campaign.findUnique({
    where: { inviteCode: code },
    include: { owner: true, _count: { select: { members: true } } },
  });
  if (!campaign) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>You&apos;ve been invited to join</CardTitle>
          <CardDescription className="text-base font-medium text-foreground">
            {campaign.name}
          </CardDescription>
          {campaign.description && (
            <CardDescription>{campaign.description}</CardDescription>
          )}
          <CardDescription>
            DM: {campaign.owner.name ?? campaign.owner.email} ·{" "}
            {campaign._count.members} {campaign._count.members === 1 ? "member" : "members"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {session?.user ? (
            <JoinCampaignButton inviteCode={code} />
          ) : (
            <Button asChild className="w-full">
              <Link href={`/signin?callbackUrl=/invite/${code}`}>
                Sign in to join
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
