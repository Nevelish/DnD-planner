import type { RsvpStatus } from "@prisma/client";

type Vote = { memberId: string; choice: RsvpStatus };

export type OptionTally = {
  yes: string[];
  maybe: string[];
  no: string[];
  noReply: string[];
  score: number;
};

/** Groups one date's votes by answer (as member ids), counting players who
 * haven't answered yet. Yes is worth 2, Maybe 1 — a date three people can
 * definitely make beats one where everyone's unsure. */
export function tallyOption(votes: Vote[], playerIds: string[]): OptionTally {
  const byMember = new Map(votes.map((v) => [v.memberId, v.choice]));
  const tally: OptionTally = { yes: [], maybe: [], no: [], noReply: [], score: 0 };
  for (const id of playerIds) {
    const choice = byMember.get(id);
    if (choice === "YES") tally.yes.push(id);
    else if (choice === "MAYBE") tally.maybe.push(id);
    else if (choice === "NO") tally.no.push(id);
    else tally.noReply.push(id);
  }
  tally.score = tally.yes.length * 2 + tally.maybe.length;
  return tally;
}

export function isPast(date: Date): boolean {
  return date.getTime() <= Date.now();
}

/** The best still-upcoming date: highest score, then most Yeses, then
 * earliest. Null until at least one player has said Yes or Maybe. */
export function bestOptionId(
  options: { id: string; startsAt: Date; tally: OptionTally }[],
): string | null {
  const ranked = options
    .filter((o) => !isPast(o.startsAt) && o.tally.score > 0)
    .sort(
      (a, b) =>
        b.tally.score - a.tally.score ||
        b.tally.yes.length - a.tally.yes.length ||
        a.startsAt.getTime() - b.startsAt.getTime(),
    );
  return ranked[0]?.id ?? null;
}
