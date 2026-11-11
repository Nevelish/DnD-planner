import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteCodeBox } from "@/components/campaigns/invite-code-box";
import { MemberList } from "@/components/campaigns/member-list";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const [campaign, members, origin] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
    prisma.campaignMember.findMany({
      where: { campaignId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    getRequestOrigin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {isDM && (
        <Card>
          <CardHeader>
            <CardTitle>Invite players</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <InviteCodeBox
              campaignId={campaignId}
              inviteCode={campaign.inviteCode}
              origin={origin}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <MemberList
            campaignId={campaignId}
            members={members}
            currentUserId={userId}
            isDM={isDM}
          />
        </CardContent>
      </Card>
    </div>
  );
}
