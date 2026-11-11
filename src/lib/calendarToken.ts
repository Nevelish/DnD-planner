import "server-only";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/prisma";

/** Generates and persists a calendar subscription token for a user who
 * doesn't have one yet, the same lazy pattern as the recurring-session
 * draft generation — called from a page render rather than a dedicated
 * "set up your calendar" step. */
export async function ensureCalendarToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { calendarToken: true },
  });
  if (user.calendarToken) return user.calendarToken;

  const calendarToken = nanoid(32);
  await prisma.user.update({ where: { id: userId }, data: { calendarToken } });
  return calendarToken;
}
