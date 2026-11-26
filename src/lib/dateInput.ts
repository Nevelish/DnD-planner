import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// Reads a date and a time typed as free text (Discord pop-ups have no date
// picker): "26.12", "26/12/2027", "2027-12-26", "26 dec", "dec 26" and
// "19:00", "19.00", "1900", "19", "7pm". Day before month, as in Norway.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
};

type DayMonthYear = { day: number; month: number; year?: number };

function readDate(text: string): DayMonthYear | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  m = t.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?\.?$/);
  if (m) return { day: +m[1], month: +m[2], year: m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : undefined };
  m = t.match(/^(\d{1,2})\.? ([a-zæøå]{3,})\.?(?: (\d{4}))?$/); // "26 dec", "26. desember 2027"
  if (m && MONTHS[m[2].slice(0, 3)]) return { day: +m[1], month: MONTHS[m[2].slice(0, 3)], year: m[3] ? +m[3] : undefined };
  m = t.match(/^([a-z]{3,})\.? (\d{1,2})(?:st|nd|rd|th)?,?(?: (\d{4}))?$/); // "dec 26", "december 26th, 2027"
  if (m && MONTHS[m[1].slice(0, 3)]) return { day: +m[2], month: MONTHS[m[1].slice(0, 3)], year: m[3] ? +m[3] : undefined };
  return null;
}

function readTime(text: string): { hour: number; minute: number } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let hour = +m[1];
  const minute = m[2] ? +m[2] : 0;
  if (m[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (m[3] === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The moment a typed date and time mean in `timeZone`. Without a year, it's
 * the next time that date comes around. Returns an error to show instead
 * when either can't be read, or the date doesn't exist (31.02).
 */
export function readDateAndTime(
  dateText: string,
  timeText: string,
  timeZone: string,
  now = new Date(),
): { date: Date } | { error: string } {
  const date = readDate(dateText);
  if (!date) return { error: "I couldn't read that date. Try 26.12 or 26.12.2027." };
  const time = readTime(timeText);
  if (!time) return { error: "I couldn't read that time. Try 19:00." };

  const at = (year: number) => {
    const local = `${year}-${pad(date.month)}-${pad(date.day)}T${pad(time.hour)}:${pad(time.minute)}:00`;
    const moment = fromZonedTime(local, timeZone);
    // A date that doesn't exist (31.02) is invalid, or comes back as another day.
    if (Number.isNaN(moment.getTime())) return null;
    const valid = formatInTimeZone(moment, timeZone, "yyyy-MM-dd'T'HH:mm:ss") === local;
    return valid ? moment : null;
  };

  if (date.year !== undefined) {
    const moment = at(date.year);
    return moment ? { date: moment } : { error: "That date doesn't exist. Check the day and month." };
  }
  const thisYear = Number(formatInTimeZone(now, timeZone, "yyyy"));
  for (const year of [thisYear, thisYear + 1, thisYear + 2, thisYear + 3, thisYear + 4]) {
    const moment = at(year);
    if (moment && moment.getTime() > now.getTime()) return { date: moment };
  }
  return { error: "That date doesn't exist. Check the day and month." };
}
