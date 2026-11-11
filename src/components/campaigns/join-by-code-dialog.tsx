"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRoundIcon } from "lucide-react";

import { joinCampaignByCode } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Accepts either a bare invite code or a full invite link and returns the code. */
function extractInviteCode(input: string) {
  const trimmed = input.trim();
  const match = trimmed.match(/\/invite\/([^/?#]+)/);
  return match ? match[1] : trimmed;
}

export function JoinByCodeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    const inviteCode = extractInviteCode(code);
    if (!inviteCode) return;

    startTransition(async () => {
      try {
        const { campaignId } = await joinCampaignByCode(inviteCode);
        setOpen(false);
        setCode("");
        router.push(`/campaigns/${campaignId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRoundIcon /> Join campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a campaign</DialogTitle>
          <DialogDescription>
            Enter the invite code your DM shared with you — or paste the whole
            invite link, that works too.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input
            id="invite-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. a1b2c3d4e5"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleJoin();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button disabled={!code.trim() || isPending} onClick={handleJoin}>
            {isPending ? "Joining…" : "Join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
