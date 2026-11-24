"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { decidePoll } from "@/lib/actions/poll";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DecidePollButton({
  campaignId,
  pollId,
  optionId,
  dateLabel,
  highlighted,
}: {
  campaignId: string;
  pollId: string;
  optionId: string;
  dateLabel: string;
  highlighted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDecide() {
    startTransition(async () => {
      try {
        const { sessionId } = await decidePoll(campaignId, pollId, optionId);
        toast.success("Session proposed for that date.");
        setOpen(false);
        router.push(`/campaigns/${campaignId}/sessions/${sessionId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={highlighted ? "default" : "outline"}>
          Pick this date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Go with {dateLabel}?</DialogTitle>
          <DialogDescription>
            This closes the poll and proposes the session for that date.
            Everyone&apos;s RSVP starts from their vote, so nobody has to
            answer twice.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button disabled={isPending} onClick={handleDecide}>
            {isPending ? "Proposing…" : "Pick this date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
