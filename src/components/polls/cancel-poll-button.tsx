"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelPoll } from "@/lib/actions/poll";
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
import { errorMessage } from "@/lib/userError";

export function CancelPollButton({ campaignId, pollId }: { campaignId: string; pollId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelPoll(campaignId, pollId);
        toast.success("Poll cancelled.");
        setOpen(false);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Cancel poll
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this poll?</DialogTitle>
          <DialogDescription>
            Votes so far are kept for reference, but nobody can vote any more.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep it open
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={handleCancel}>
            {isPending ? "Cancelling…" : "Cancel poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
