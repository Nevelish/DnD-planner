import type { SessionFormat } from "@prisma/client";

/** Just the fields the session dialog edits. Pass this rather than a whole
 * proposal: a client component's props are sent to the browser in full, and
 * a proposal loaded with its RSVPs drags every member's row along. */
export function proposalDefaults(p: {
  title: string | null;
  startsAt: Date;
  durationMinutes: number | null;
  format: SessionFormat | null;
  location: string | null;
  description: string | null;
}) {
  return {
    title: p.title,
    startsAt: p.startsAt,
    durationMinutes: p.durationMinutes,
    format: p.format,
    location: p.location,
    description: p.description,
  };
}
