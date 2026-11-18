import "server-only";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import type { TimeFormat, DateFormat } from "@prisma/client";

/** Fixed Norwegian-style (24h, day-before-month) format for text that's
 * shared across every viewer at once — in-app notification bodies and
 * Discord embeds — which can't be personalized since one string is stored
 * for every recipient. For anything rendered to one specific signed-in
 * viewer, use the *ForUser variants below instead, which read that
 * person's own saved preference. */
export function formatSessionDateTime(date: Date): string {
  return format(date, "EEEE d MMMM 'at' HH:mm");
}

export type DateTimePrefs = { timeFormat: TimeFormat; dateFormat: DateFormat };

/** Reads one user's saved clock/date-order preference (see User.timeFormat
 * / User.dateFormat), for pages rendering dates to that specific viewer. */
export async function getDateTimePrefs(userId: string): Promise<DateTimePrefs> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timeFormat: true, dateFormat: true },
  });
}

function timePattern(prefs: DateTimePrefs): string {
  return prefs.timeFormat === "HOUR_24" ? "HH:mm" : "h:mm a";
}

export function formatSessionDateTimeForUser(date: Date, prefs: DateTimePrefs): string {
  const dayMonth = prefs.dateFormat === "DMY" ? "d MMMM" : "MMMM d";
  return format(date, `EEEE ${dayMonth} 'at' ${timePattern(prefs)}`);
}

export function formatCompactDateTimeForUser(date: Date, prefs: DateTimePrefs): string {
  const dayMonth = prefs.dateFormat === "DMY" ? "d MMM" : "MMM d";
  return format(date, `${dayMonth} 'at' ${timePattern(prefs)}`);
}

export function formatDateOnlyForUser(date: Date, prefs: DateTimePrefs): string {
  return format(date, prefs.dateFormat === "DMY" ? "d MMMM yyyy" : "MMMM d, yyyy");
}

/** date-fns' startOfWeek weekStartsOn value: Monday for the Norwegian/
 * European DMY convention, Sunday for the US MDY one. */
export function weekStartsOnForUser(prefs: DateTimePrefs): 0 | 1 {
  return prefs.dateFormat === "DMY" ? 1 : 0;
}
