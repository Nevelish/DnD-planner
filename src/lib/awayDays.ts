// Away dates as plain "YYYY-MM-DD" day strings, so the same helpers work on
// the server and in the browser without timezone surprises. Keep this free of
// server-only code: the session and poll dialogs use it too.

/** One person's away period, as sent to the pages that show it. */
export type AwayRange = {
  name: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string; // YYYY-MM-DD, inclusive
  note: string | null;
};

/** The away periods that include `day` ("YYYY-MM-DD"). */
export function awayOn<T extends { startsOn: string; endsOn: string }>(ranges: T[], day: string): T[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  return ranges.filter((r) => r.startsOn <= day && day <= r.endsOn);
}

/** "Rin Rogue (holiday)", for a list of who's away. */
export function awayName(range: Pick<AwayRange, "name" | "note">): string {
  return range.note ? `${range.name} (${range.note})` : range.name;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month: MONTHS[month - 1], date };
}

/**
 * A short label for a range of days: "20–27 December", "30 December – 2
 * January 2027", or with month first ("December 20–27") for people who use
 * that order. The year is only shown when it isn't `currentYear`.
 */
export function formatDayRange(startsOn: string, endsOn: string, { monthFirst = false, currentYear = new Date().getFullYear() } = {}) {
  const a = parts(startsOn);
  const b = parts(endsOn);
  const year = (y: number) => (y === currentYear ? "" : ` ${y}`);
  const day = (p: ReturnType<typeof parts>) => (monthFirst ? `${p.month} ${p.date}` : `${p.date} ${p.month}`);

  if (startsOn === endsOn) return `${day(a)}${year(a.year)}`;
  if (a.year === b.year && a.month === b.month) {
    return monthFirst ? `${a.month} ${a.date}–${b.date}${year(a.year)}` : `${a.date}–${b.date} ${a.month}${year(a.year)}`;
  }
  if (a.year === b.year) return `${day(a)} – ${day(b)}${year(a.year)}`;
  return `${day(a)} ${a.year} – ${day(b)} ${b.year}`;
}
