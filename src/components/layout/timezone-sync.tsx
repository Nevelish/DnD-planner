"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { TIMEZONE_COOKIE } from "@/lib/timezoneCookie";

/** Reports the browser's timezone to the server via a cookie, so server-
 * rendered session times show in each viewer's local time rather than the
 * container's. Refreshes once if it had to set or change the cookie. */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;

    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TIMEZONE_COOKIE}=`))
      ?.slice(TIMEZONE_COOKIE.length + 1);
    if (current === timeZone) return;

    document.cookie = `${TIMEZONE_COOKIE}=${timeZone}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
