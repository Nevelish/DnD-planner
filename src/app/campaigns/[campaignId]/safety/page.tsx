import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { SESSION_ZERO_QUESTIONS, parseSessionZero } from "@/lib/sessionZero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinesAndVeils } from "@/components/safety/lines-and-veils";
import { SessionZeroForm } from "@/components/safety/session-zero-form";

export default async function SafetyPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const [campaign, entries] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { sessionZero: true },
    }),
    prisma.safetyEntry.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, text: true, authorId: true },
    }),
  ]);
  const answers = parseSessionZero(campaign.sessionZero);
  const answered = SESSION_ZERO_QUESTIONS.filter((q) => answers[q.key]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Lines &amp; veils</CardTitle>
          <CardDescription>
            Content the group has agreed to keep out of the game, or off-screen.
            Anyone can add to this at any time, and everyone at the table
            respects it.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <LinesAndVeils
            campaignId={campaignId}
            isDM={isDM}
            // Only "is this mine?" leaves the server, never who wrote what.
            entries={entries.map(({ authorId, ...e }) => ({ ...e, mine: authorId === userId }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Zero</CardTitle>
          <CardDescription>
            {isDM
              ? "How this table plays. Fill in what matters to your group and leave the rest blank; players see your answers here."
              : "How this table plays, as agreed with the DM."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {isDM ? (
            <SessionZeroForm campaignId={campaignId} answers={answers} />
          ) : answered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The DM hasn&apos;t filled this in yet.
            </p>
          ) : (
            <dl className="flex flex-col divide-y">
              {answered.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                    {answers[key]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
