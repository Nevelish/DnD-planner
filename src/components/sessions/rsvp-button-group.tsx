"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";

import { respond } from "@/lib/actions/rsvp";
import { Button } from "@/components/ui/button";
import { CancelReasonDialog } from "@/components/sessions/cancel-reason-dialog";
import type { RsvpStatus } from "@prisma/client";

const SUCCESS_MESSAGE = {
  YES: "You're in!",
  MAYBE: "Marked as maybe.",
  NO: "Marked as not attending.",
} as const;

export function RsvpButtonGroup({
  campaignId,
  proposalId,
  currentStatus,
}: {
  campaignId: string;
  proposalId: string;
  currentStatus: RsvpStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  function submit(status: "YES" | "MAYBE" | "NO", reason?: string) {
    startTransition(async () => {
      try {
        await respond(campaignId, proposalId, status, reason);
        setDialogOpen(false);
        toast.success(SUCCESS_MESSAGE[status]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleNoClick() {
    if (currentStatus === "YES") {
      setDialogOpen(true);
    } else {
      submit("NO");
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={currentStatus === "YES" ? "default" : "outline"}
          disabled={isPending}
          onClick={() => submit("YES")}
        >
          <CheckIcon /> Yes, I&apos;m in
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={
            currentStatus === "MAYBE"
              ? "border-transparent bg-amber-700 text-white hover:bg-amber-700/90 hover:text-white"
              : undefined
          }
          disabled={isPending}
          onClick={() => submit("MAYBE")}
        >
          <CircleHelpIcon /> Maybe
        </Button>
        <Button
          size="sm"
          variant={currentStatus === "NO" ? "destructive" : "outline"}
          disabled={isPending}
          onClick={handleNoClick}
        >
          <XIcon /> Can&apos;t make it
        </Button>
      </div>
      <CancelReasonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPending={isPending}
        onConfirm={(reason) => submit("NO", reason)}
      />
    </>
  );
}
