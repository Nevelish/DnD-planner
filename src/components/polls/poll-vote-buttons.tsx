"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";

import { votePoll } from "@/lib/actions/poll";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/userError";

type Choice = "YES" | "MAYBE" | "NO";

const CHOICES: { value: Choice; label: string; icon: typeof CheckIcon; active: string }[] = [
  { value: "YES", label: "Yes", icon: CheckIcon, active: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" },
  { value: "MAYBE", label: "Maybe", icon: CircleHelpIcon, active: "border-transparent bg-amber-700 text-white hover:bg-amber-700/90 hover:text-white" },
  { value: "NO", label: "No", icon: XIcon, active: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground" },
];

export function PollVoteButtons({
  campaignId,
  pollId,
  optionId,
  current,
  dateLabel,
}: {
  campaignId: string;
  pollId: string;
  optionId: string;
  current: Choice | null;
  dateLabel: string;
}) {
  const [isPending, startTransition] = useTransition();

  function vote(choice: Choice) {
    startTransition(async () => {
      try {
        await votePoll(campaignId, pollId, optionId, choice);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <div className="flex gap-1.5" role="group" aria-label={`Can you make ${dateLabel}?`}>
      {CHOICES.map(({ value, label, icon: Icon, active }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={current === value}
          disabled={isPending}
          className={cn(current === value && active)}
          onClick={() => vote(value)}
        >
          <Icon /> {label}
        </Button>
      ))}
    </div>
  );
}
