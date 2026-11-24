import "server-only";

/** Escapes text per RFC 5545 §3.3.11 (comma, semicolon, backslash, newline). */
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "\\n");
}

/** Folds a content line at 75 octets, per RFC 5545 §3.1 (continuation lines
 * start with a single space). Counts UTF-8 bytes, not characters, so lines
 * with æ/ø/å stay within the limit, and never splits a character in two.
 * Keeps feeds valid for strict calendar clients. */
function foldLine(line: string) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines spend one of their 75 octets on the leading space.
    const limit = chunks.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      chunks.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

function formatICSDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export type ICSEvent = {
  uid: string;
  summary: string;
  startsAt: Date;
  endsAt: Date;
  status: "TENTATIVE" | "CONFIRMED";
  url?: string;
  location?: string;
  description?: string;
  /** Adds a calendar-app alert this many minutes before the start. */
  alarmMinutesBefore?: number;
};

export function buildICSFeed(calendarName: string, events: ICSEvent[]) {
  const now = formatICSDate(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DnD Planner//Session Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}@dnd-planner`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatICSDate(event.startsAt)}`,
      `DTEND:${formatICSDate(event.endsAt)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `STATUS:${event.status}`,
      ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      ...(event.url ? [`URL:${event.url}`] : []),
      ...(event.alarmMinutesBefore
        ? [
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            `DESCRIPTION:${escapeText(event.summary)}`,
            `TRIGGER:-PT${event.alarmMinutesBefore}M`,
            "END:VALARM",
          ]
        : []),
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
