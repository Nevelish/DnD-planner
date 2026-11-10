"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2Icon } from "lucide-react";

import { confirmProposal } from "@/lib/actions/session";
import { Button } from "@/components/ui/button";

export function ConfirmProposalButton({
  campaignId,
  proposalId,
}: {
  campaignId: string;
  proposalId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await confirmProposal(campaignId, proposalId);
        toast.success("Session confirmed.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleConfirm}>
      <CheckCircle2Icon /> Lock it in
    </Button>
  );
}
