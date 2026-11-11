"use client";

import { useState, useTransition } from "react";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { regenerateInviteCode } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteCodeBox({
  campaignId,
  inviteCode,
  origin,
}: {
  campaignId: string;
  inviteCode: string;
  origin: string;
}) {
  const [code, setCode] = useState(inviteCode);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const inviteUrl = `${origin}/invite/${code}`;

  function copy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function regenerate() {
    startTransition(async () => {
      try {
        const next = await regenerateInviteCode(campaignId);
        setCode(next);
        toast.success("Invite link regenerated. The old link no longer works.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input readOnly value={inviteUrl} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        disabled={isPending}
        onClick={regenerate}
      >
        <RefreshCwIcon /> Regenerate link
      </Button>
    </div>
  );
}
