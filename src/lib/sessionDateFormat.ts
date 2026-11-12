import { format } from "date-fns";

/** The one place this app's "session date/time" display format is defined —
 * used anywhere a session's startsAt needs to read as a sentence (the draft
 * card, notifications), so it can't drift between those surfaces. */
export function formatSessionDateTime(date: Date): string {
  return format(date, "EEEE, MMMM d 'at' h:mm a");
}
