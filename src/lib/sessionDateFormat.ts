import "server-only";
import { formatInTimeZone } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { getRequestTimeZone } from "@/lib/timezone";
import type { TimeFormat, DateFormat } from "@prisma/client";

/** Fixed Norwegian-style (24h, day-before-month) format for text that's
 * shared across every viewer at once — in-app notification bodies and
 * Discord embeds — which can't be personalized since one string is stored
 * for every recipient. Rendered in the timezone of whoever triggered it
 * (the browser making this request). For anything rendered to one specific
 * signed-in viewer, use the *ForUser variants below instead. */
export async function formatSessionDateTime(date: Date): Promise<string> {
  return formatSessionDateTimeInTimeZone(date, await getRequestTimeZone());
}

/** Same broadcast format, for text generated outside any request (where
 * there's no browser timezone to read), e.g. scheduled reminders. */
export function formatSessionDateTimeInTimeZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, "EEEE d MMMM 'at' HH:mm");
}

export type DateTimePrefs = {
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  timeZone: string;
};

/** Reads one user's saved clock/date-order preference (see User.timeFormat
 * / User.dateFormat) plus their browser's timezone, for pages rendering
 * dates to that specific viewer. */
export async function getDateTimePrefs(userId: string): Promise<DateTimePrefs> {
  const [prefs, timeZone] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timeFormat: true, dateFormat: true },
    }),
    getRequestTimeZone(),
  ]);
  return { ...prefs, timeZone };
}

function timePattern(prefs: DateTimePrefs): string {
  return prefs.timeFormat === "HOUR_24" ? "HH:mm" : "h:mm a";
}

export function formatSessionDateTimeForUser(date: Date, prefs: DateTimePrefs): string {
  const dayMonth = prefs.dateFormat === "DMY" ? "d MMMM" : "MMMM d";
  return formatInTimeZone(date, prefs.timeZone, `EEEE ${dayMonth} 'at' ${timePattern(prefs)}`);
}

export function formatCompactDateTimeForUser(date: Date, prefs: DateTimePrefs): string {
  const dayMonth = prefs.dateFormat === "DMY" ? "d MMM" : "MMM d";
  return formatInTimeZone(date, prefs.timeZone, `${dayMonth} 'at' ${timePattern(prefs)}`);
}

export function formatDateOnlyForUser(date: Date, prefs: DateTimePrefs): string {
  return formatInTimeZone(
    date,
    prefs.timeZone,
    prefs.dateFormat === "DMY" ? "d MMMM yyyy" : "MMMM d, yyyy",
  );
}

/** date-fns' startOfWeek weekStartsOn value: Monday for the Norwegian/
 * European DMY convention, Sunday for the US MDY one. */
export function weekStartsOnForUser(prefs: DateTimePrefs): 0 | 1 {
  return prefs.dateFormat === "DMY" ? 1 : 0;
}
