import Link from "next/link";

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type OpenPollSummary = {
  id: string;
  title: string | null;
  options: { votes: { memberId: string }[] }[];
};

export function OpenPollCard({
  campaignId,
  poll,
  isDM,
  currentMemberId,
  playerCount,
}: {
  campaignId: string;
  poll: OpenPollSummary;
  isDM: boolean;
  currentMemberId: string;
  playerCount: number;
}) {
  const answered = poll.options.filter((o) =>
    o.votes.some((v) => v.memberId === currentMemberId),
  ).length;
  const voters = new Set(poll.options.flatMap((o) => o.votes.map((v) => v.memberId))).size;
  const needsMyVote = !isDM && answered < poll.options.length;

  return (
    <Card className={needsMyVote ? "border-primary/60" : undefined}>
      <CardHeader className="pb-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>
              {isDM ? "Date poll in progress" : "Vote on the next session date"}
              {poll.title ? ` — ${poll.title}` : ""}
            </CardTitle>
            <CardDescription>
              {isDM
                ? `${voters} of ${playerCount} players have voted on ${poll.options.length} dates.`
                : `You've answered ${answered} of ${poll.options.length} dates.`}
            </CardDescription>
          </div>
          <CardAction>
            <Button asChild size="sm" variant={needsMyVote ? "default" : "outline"}>
              <Link href={`/campaigns/${campaignId}/polls/${poll.id}`}>
                {isDM ? "See results" : needsMyVote ? "Vote now" : "Change votes"}
              </Link>
            </Button>
          </CardAction>
        </div>
      </CardHeader>
    </Card>
  );
}
