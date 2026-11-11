import "server-only";

/** Escapes text per RFC 5545 §3.3.11 (comma, semicolon, backslash, newline). */
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Folds a content line at 75 octets, per RFC 5545 §3.1 (continuation lines
 * start with a single space). Keeps feeds valid for strict calendar clients. */
function foldLine(line: string) {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
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
      ...(event.url ? [`URL:${event.url}`] : []),
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
