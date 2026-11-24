import type { Prisma } from "@prisma/client";

/**
 * The only user fields that are safe to show other people. Use this
 * whenever a query includes someone else's user row — never `user: true`:
 * a full row carries passwordHash, calendarToken, discordUserId etc., and
 * anything handed to a client component is sent to the browser in full,
 * whatever its TypeScript type says.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const satisfies Prisma.UserSelect;
