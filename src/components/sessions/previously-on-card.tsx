import Link from "next/link";

import { formatSessionDateTimeForUser, type DateTimePrefs } from "@/lib/sessionDateFormat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";

/** The latest recap, as a "previously on…" refresher before the next game.
 * Long recaps are clipped with a fade; the full text is a click away. */
export function PreviouslyOnCard({
  campaignId,
  session,
  prefs,
}: {
  campaignId: string;
  session: { id: string; title: string | null; startsAt: Date; recap: string };
  prefs: DateTimePrefs;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Previously on…</CardTitle>
        <CardDescription>
          {session.title ? `${session.title} · ` : ""}
          {formatSessionDateTimeForUser(session.startsAt, prefs)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-6">
        <div className="relative max-h-64 overflow-hidden">
          <MarkdownRenderer content={session.recap} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/campaigns/${campaignId}/sessions/${session.id}`}>Read the full recap</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/campaigns/${campaignId}/log`}>Campaign log</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
