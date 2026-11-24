import "server-only";
import { cookies } from "next/headers";

import { TIMEZONE_COOKIE } from "@/lib/timezoneCookie";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The IANA timezone of the browser making this request, as reported by
 * TimeZoneSync. Falls back to the server's own zone (UTC in Docker) only
 * before that cookie exists, i.e. a visitor's very first page load. */
export async function getRequestTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  if (value && isValidTimeZone(value)) return value;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
