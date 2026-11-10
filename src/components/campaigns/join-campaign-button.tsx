"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { joinCampaignByCode } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";

export function JoinCampaignButton({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      try {
        const { campaignId } = await joinCampaignByCode(inviteCode);
        router.push(`/campaigns/${campaignId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Button className="w-full" disabled={isPending} onClick={handleJoin}>
      {isPending ? "Joining…" : "Join as Player"}
    </Button>
  );
}
