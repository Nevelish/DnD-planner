import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { completePastSessions } from "@/lib/completeSessions";
import { formatSessionDateTimeForUser, getDateTimePrefs } from "@/lib/sessionDateFormat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";

/** Every played session's recap, oldest first, so it reads as the story
 * of the campaign so far. */
export default async function CampaignLogPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId } = await requireMembershipForPage(campaignId);

  await completePastSessions([campaignId]);

  const [sessions, prefs] = await Promise.all([
    prisma.sessionProposal.findMany({
      where: { campaignId, status: "COMPLETED" },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, recap: true },
    }),
    getDateTimePrefs(userId),
  ]);
  const written = sessions.filter((s) => s.recap).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Campaign log</h2>
        {sessions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {written} of {sessions.length} {sessions.length === 1 ? "session has" : "sessions have"} a recap
          </p>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing here yet. Once a session has been played, its recap shows up
          here.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {sessions.map((s, i) => (
            <li key={s.id}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Link
                      href={`/campaigns/${campaignId}/sessions/${s.id}`}
                      className="hover:underline"
                    >
                      {s.title || `Session ${i + 1}`}
                    </Link>
                  </CardTitle>
                  <CardDescription>{formatSessionDateTimeForUser(s.startsAt, prefs)}</CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  {s.recap ? (
                    <MarkdownRenderer content={s.recap} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No recap yet.{" "}
                      <Link
                        href={`/campaigns/${campaignId}/sessions/${s.id}`}
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        Write one
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
