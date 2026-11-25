import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AvatarUser } from "@/lib/avatar";
import type { RsvpStatus } from "@prisma/client";

type RsvpRow = {
  id: string;
  status: RsvpStatus;
  cancellationReason: string | null;
  member: { user: AvatarUser & { id: string; name: string | null; email: string | null } };
};

const statusVariant: Record<RsvpStatus, "success" | "warning" | "destructive" | "secondary"> = {
  YES: "success",
  MAYBE: "warning",
  NO: "destructive",
  PENDING: "secondary",
};

const statusLabel: Record<RsvpStatus, string> = {
  YES: "Going",
  MAYBE: "Maybe",
  NO: "Can't make it",
  PENDING: "No response yet",
};

/**
 * `away` maps the user id of each player who's away on the session's day to
 * their away note (or null). Someone away who hasn't answered shows as
 * "Away" rather than "No response yet".
 */
export function RsvpList({ rsvps, away = {} }: { rsvps: RsvpRow[]; away?: Record<string, string | null> }) {
  if (rsvps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No players in this campaign yet.</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {rsvps.map((rsvp) => {
        const userId = rsvp.member.user.id;
        const isAway = userId in away;
        const awayNote = away[userId];
        return (
          <li key={rsvp.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                <UserAvatar user={rsvp.member.user} className="size-7" />
                {rsvp.member.user.name ?? rsvp.member.user.email}
              </span>
              <Badge variant={statusVariant[rsvp.status]}>
                {isAway && rsvp.status === "PENDING" ? "Away" : statusLabel[rsvp.status]}
              </Badge>
            </div>
            {isAway && (
              <p className="text-sm text-muted-foreground">
                Away that day{awayNote ? `: ${awayNote}` : ""}
              </p>
            )}
            {rsvp.cancellationReason && (
              <p className="text-sm text-muted-foreground">
                &ldquo;{rsvp.cancellationReason}&rdquo;
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
