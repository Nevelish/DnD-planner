import { PlaneIcon } from "lucide-react";

import { awayName, awayOn, type AwayRange } from "@/lib/awayDays";
import { cn } from "@/lib/utils";

/**
 * "Away that day: Rin Rogue (holiday)" under a date input, when anyone in
 * the campaign is away on the day it's set to. `value` is the input's
 * "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD") value.
 */
export function AwayWarning({ away, value, compact = false }: { away: AwayRange[]; value: string; compact?: boolean }) {
  const clashes = awayOn(away, value.slice(0, 10));
  if (clashes.length === 0) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-1.5 text-amber-700 dark:text-amber-400",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <PlaneIcon className={cn("mt-0.5 shrink-0", compact ? "size-3" : "size-3.5")} aria-hidden />
      <span>Away that day: {clashes.map(awayName).join(", ")}</span>
    </p>
  );
}
