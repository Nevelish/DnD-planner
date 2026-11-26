"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { allowBackIntoCampaign } from "@/lib/actions/campaign";
import { errorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";

/** People the DM removed, who can't rejoin until allowed back. */
export function RemovedPlayers({
  campaignId,
  removed,
}: {
  campaignId: string;
  removed: { id: string; name: string; removedOn: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function allowBack(entry: { id: string; name: string }) {
    startTransition(async () => {
      try {
        await allowBackIntoCampaign(campaignId, entry.id);
        toast.success(`${entry.name} can rejoin now, with the invite link or from Discord.`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border" aria-label="Removed players">
      {removed.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{entry.name}</span>
            <span className="text-xs text-muted-foreground">Removed {entry.removedOn}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => allowBack(entry)}
            aria-label={`Allow ${entry.name} back`}
          >
            Allow back
          </Button>
        </li>
      ))}
    </ul>
  );
}
