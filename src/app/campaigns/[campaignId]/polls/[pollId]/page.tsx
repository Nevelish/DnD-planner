import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { formatSessionDateTimeForUser, getDateTimePrefs } from "@/lib/sessionDateFormat";
import { bestOptionId, isPast, tallyOption, type OptionTally } from "@/lib/pollResults";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PollVoteButtons } from "@/components/polls/poll-vote-buttons";
import { DecidePollButton } from "@/components/polls/decide-poll-button";
import { CancelPollButton } from "@/components/polls/cancel-poll-button";
import { AddPollDateForm } from "@/components/polls/add-poll-date-form";
import { RemovePollDateButton } from "@/components/polls/remove-poll-date-button";
import { MAX_POLL_OPTIONS } from "@/lib/validations/poll";
import { groupDay, loadCampaignAway } from "@/lib/away";
import { awayName, awayOn } from "@/lib/awayDays";

const statusBadge = {
  OPEN: { label: "Voting open", variant: "secondary" },
  DECIDED: { label: "Date picked", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
} as const;

const ANSWER_GROUPS: { key: keyof Omit<OptionTally, "score">; label: string }[] = [
  { key: "yes", label: "Yes" },
  { key: "maybe", label: "Maybe" },
  { key: "no", label: "No" },
  { key: "noReply", label: "No reply" },
];

export default async function DatePollPage({
  params,
}: {
  params: Promise<{ campaignId: string; pollId: string }>;
}) {
  const { campaignId, pollId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const [poll, players, prefs, away] = await Promise.all([
    prisma.datePoll.findFirst({
      where: { id: pollId, campaignId },
      include: {
        options: {
          orderBy: { startsAt: "asc" },
          include: { votes: true, addedBy: { select: { id: true, name: true, email: true } } },
        },
        sessionProposal: { select: { id: true, startsAt: true } },
      },
    }),
    prisma.campaignMember.findMany({
      where: { campaignId, role: "PLAYER" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    getDateTimePrefs(userId),
    loadCampaignAway(campaignId),
  ]);
  if (!poll) notFound();

  const playerIds = players.map((p) => p.id);
  const nameOf = new Map(players.map((p) => [p.id, p.user.name ?? p.user.email ?? "Unknown"]));
  const memberOfUser = new Map(players.map((p) => [p.userId, p.id]));
  const options = poll.options.map((o) => {
    const tally = tallyOption(o.votes, playerIds);
    // Players away that day who haven't answered are listed as away rather
    // than under "No reply". Anyone who did answer keeps their answer.
    const awayUnanswered = awayOn(away, groupDay(o.startsAt)).filter((a) => {
      const memberId = memberOfUser.get(a.userId);
      return memberId !== undefined && tally.noReply.includes(memberId);
    });
    const awayMemberIds = new Set(awayUnanswered.map((a) => memberOfUser.get(a.userId)));
    tally.noReply = tally.noReply.filter((id) => !awayMemberIds.has(id));
    return {
      ...o,
      tally,
      away: awayUnanswered,
      label: formatSessionDateTimeForUser(o.startsAt, prefs),
      isPast: isPast(o.startsAt),
    };
  });
  const bestId = poll.status === "OPEN" ? bestOptionId(options) : null;
  const votedCount = players.filter((p) =>
    poll.options.some((o) => o.votes.some((v) => v.memberId === p.id)),
  ).length;
  const isOpen = poll.status === "OPEN";
  const hours = poll.durationMinutes / 60;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{poll.title || "Find a date for the next session"}</CardTitle>
            <CardDescription>
              {options.length} dates · {hours} {hours === 1 ? "hour" : "hours"} each ·{" "}
              {votedCount} of {players.length} players have voted
            </CardDescription>
          </div>
          <CardAction>
            <Badge variant={statusBadge[poll.status].variant}>
              {statusBadge[poll.status].label}
            </Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-6">
        {poll.status === "DECIDED" && poll.sessionProposal && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-3 text-sm">
            <span>
              Session proposed for{" "}
              {formatSessionDateTimeForUser(poll.sessionProposal.startsAt, prefs)}.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/campaigns/${campaignId}/sessions/${poll.sessionProposal.id}`}>
                Go to session
              </Link>
            </Button>
          </div>
        )}

        {isOpen && !isDM && (
          <p className="text-sm text-muted-foreground">
            Mark every date you could make. You can change your answers until
            the DM picks one.
          </p>
        )}

        <ul className="flex flex-col divide-y rounded-lg border">
          {options.map((option) => {
            const myVote = option.votes.find((v) => v.memberId === membership.id)?.choice;
            const picked =
              poll.sessionProposal?.startsAt.getTime() === option.startsAt.getTime();
            return (
              <li
                key={option.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={option.isPast ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                      {option.label}
                    </span>
                    {option.id === bestId && <Badge variant="success">Best so far</Badge>}
                    {picked && <Badge variant="success">Picked</Badge>}
                    {isOpen && options.length > 2 && (isDM || option.addedById === userId) && (
                      <RemovePollDateButton
                        campaignId={campaignId}
                        pollId={poll.id}
                        optionId={option.id}
                        dateLabel={option.label}
                      />
                    )}
                  </div>
                  {option.addedBy && option.addedBy.id !== poll.createdById && (
                    <p className="text-xs text-muted-foreground">
                      Suggested by{" "}
                      {option.addedBy.id === userId
                        ? "you"
                        : (option.addedBy.name ?? option.addedBy.email)}
                    </p>
                  )}
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {ANSWER_GROUPS.filter((g) => option.tally[g.key].length > 0).map((g) => (
                      <div key={g.key} className="flex gap-1">
                        <dt className="font-medium text-foreground">{g.label}:</dt>
                        <dd>{option.tally[g.key].map((id) => nameOf.get(id)).join(", ")}</dd>
                      </div>
                    ))}
                    {option.away.length > 0 && (
                      <div className="flex gap-1">
                        <dt className="font-medium text-foreground">Away:</dt>
                        <dd>{option.away.map(awayName).join(", ")}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                {isOpen && !option.isPast && (
                  <div className="shrink-0">
                    {isDM ? (
                      <DecidePollButton
                        campaignId={campaignId}
                        pollId={poll.id}
                        optionId={option.id}
                        dateLabel={option.label}
                        highlighted={option.id === bestId}
                      />
                    ) : (
                      <PollVoteButtons
                        campaignId={campaignId}
                        pollId={poll.id}
                        optionId={option.id}
                        current={myVote === "YES" || myVote === "MAYBE" || myVote === "NO" ? myVote : null}
                        dateLabel={option.label}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {isOpen && options.length < MAX_POLL_OPTIONS && (
          <AddPollDateForm campaignId={campaignId} pollId={poll.id} isDM={isDM} />
        )}

        {isOpen && isDM && (
          <div className="flex justify-end">
            <CancelPollButton campaignId={campaignId} pollId={poll.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
