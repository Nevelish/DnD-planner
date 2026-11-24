import { MapPinIcon, MonitorIcon } from "lucide-react";
import type { SessionFormat } from "@prisma/client";

import { SESSION_FORMAT_LABELS, locationHref } from "@/lib/sessionPlace";

/** Where the session is (in person / online + address or link) and the
 * DM's notes for it. Renders nothing when none of them are set. */
export function SessionPlace({
  format,
  location,
  description,
}: {
  format: SessionFormat | null;
  location: string | null;
  description: string | null;
}) {
  if (!format && !location && !description) return null;

  const Icon = format === "ONLINE" ? MonitorIcon : MapPinIcon;
  const href = locationHref(location);

  return (
    <div className="flex flex-col gap-2 text-sm">
      {(format || location) && (
        <p className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            {format && <span className="font-medium">{SESSION_FORMAT_LABELS[format]}</span>}
            {format && location && <span className="text-muted-foreground"> · </span>}
            {location &&
              (href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline underline-offset-2 hover:text-primary"
                >
                  {location}
                </a>
              ) : (
                <span className="break-words">{location}</span>
              ))}
          </span>
        </p>
      )}
      {description && (
        <p className="rounded-md bg-muted p-3 break-words whitespace-pre-wrap">{description}</p>
      )}
    </div>
  );
}
