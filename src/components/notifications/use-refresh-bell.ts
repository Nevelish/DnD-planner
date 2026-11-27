"use client";

import { useSWRConfig } from "swr";

// The keys the header's NotificationBell caches its data under.
export const BELL_COUNT_KEY = "unread-notification-count";
export const BELL_LIST_KEY = "recent-notifications";

/** Makes the bell in the header fetch its count and list again, after
 * something elsewhere changed them (clearing or marking all as read). */
export function useRefreshBell() {
  const { mutate } = useSWRConfig();
  return () => Promise.all([mutate(BELL_COUNT_KEY), mutate(BELL_LIST_KEY)]);
}
