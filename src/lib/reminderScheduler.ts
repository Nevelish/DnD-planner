import { sendDueReminders } from "@/lib/sessionReminders";

const CHECK_INTERVAL_MS = 5 * 60_000;
const FIRST_CHECK_DELAY_MS = 15_000;

const scheduler = globalThis as typeof globalThis & {
  __sessionReminderTimer?: ReturnType<typeof setInterval>;
};

/** Checks for due session reminders every few minutes for as long as the
 * server runs. The app is self-hosted as one long-running process, so this
 * stands in for a cron job without needing one configured. */
export function startReminderScheduler() {
  if (scheduler.__sessionReminderTimer) return;

  const check = () =>
    sendDueReminders().catch((err) => console.error("[reminders] check failed:", err));

  scheduler.__sessionReminderTimer = setInterval(check, CHECK_INTERVAL_MS);
  setTimeout(check, FIRST_CHECK_DELAY_MS);
}
