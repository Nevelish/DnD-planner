// Helpers for <input type="datetime-local">, whose "YYYY-MM-DDTHH:mm" value
// carries no timezone: the browser reads it as its own local time. Used in
// client components only.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Formats a Date as the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
export function toLocalInputValue(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Adds minutes to a "YYYY-MM-DDTHH:mm" string, staying in the same local wall-clock time. */
export function addMinutesToLocalValue(value: string, minutes: number) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInputValue(d);
}

/** The absolute instant for a datetime-local value, for sending to the
 * server — which would otherwise read the bare value in its own timezone. */
export function localInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
