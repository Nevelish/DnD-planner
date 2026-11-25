"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { removePollOption } from "@/lib/actions/poll";
import { errorMessage } from "@/lib/userError";

export function RemovePollDateButton({
  campaignId,
  pollId,
  optionId,
  dateLabel,
}: {
  campaignId: string;
  pollId: string;
  optionId: string;
  dateLabel: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    if (!window.confirm(`Remove ${dateLabel} from the poll? Any votes on it are lost.`)) return;
    startTransition(async () => {
      try {
        await removePollOption(campaignId, pollId, optionId);
        toast.success("Date removed.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={isPending}
      aria-label={`Remove ${dateLabel}`}
      className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <XIcon className="size-4" />
    </button>
  );
}
