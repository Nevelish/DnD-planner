import { prisma } from "@/lib/prisma";
import { PUBLIC_USER_SELECT } from "@/lib/publicUser";
import { requireMembershipForPage } from "@/lib/permissions";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteCodeBox } from "@/components/campaigns/invite-code-box";
import { MemberList } from "@/components/campaigns/member-list";
import { RemovedPlayers } from "@/components/campaigns/removed-players";
import { formatDateOnlyForUser, getDateTimePrefs } from "@/lib/sessionDateFormat";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const [campaign, members, origin, removals, prefs] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
    prisma.campaignMember.findMany({
      where: { campaignId },
      include: { user: { select: PUBLIC_USER_SELECT } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    getRequestOrigin(),
    isDM
      ? prisma.campaignRemoval.findMany({
          where: { campaignId },
          select: { id: true, name: true, removedAt: true },
          orderBy: { removedAt: "desc" },
        })
      : [],
    getDateTimePrefs(userId),
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

      {removals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Removed players</CardTitle>
            <CardDescription>
              They can&apos;t rejoin, with the invite link or from Discord, until you allow them back.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <RemovedPlayers
              campaignId={campaignId}
              removed={removals.map((r) => ({
                id: r.id,
                name: r.name,
                removedOn: formatDateOnlyForUser(r.removedAt, prefs),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
