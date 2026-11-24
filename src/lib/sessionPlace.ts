import type { SessionFormat } from "@prisma/client";

export const SESSION_FORMAT_LABELS: Record<SessionFormat, string> = {
  IN_PERSON: "In person",
  ONLINE: "Online",
};

/** Only plain web links get rendered as clickable — anything else (an
 * address, "Discord voice", a javascript: URL) stays text. */
export function locationHref(location: string | null | undefined): string | null {
  if (!location) return null;
  try {
    const url = new URL(location.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** One line for notifications and calendar feeds, e.g. "Online: Discord"
 * or "In person: Preben's place". Null when neither is set. */
export function describePlace(
  format: SessionFormat | null | undefined,
  location: string | null | undefined,
): string | null {
  const label = format ? SESSION_FORMAT_LABELS[format] : null;
  if (label && location) return `${label}: ${location}`;
  return label ?? location ?? null;
}

/** " · Online: Discord" for appending to a notification line, or "". */
export function placeSuffix(
  format: SessionFormat | null | undefined,
  location: string | null | undefined,
): string {
  const place = describePlace(format, location);
  return place ? ` · ${place}` : "";
}
