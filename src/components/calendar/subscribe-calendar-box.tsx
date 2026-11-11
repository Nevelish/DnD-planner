"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";

import { regenerateCalendarToken } from "@/lib/actions/calendarToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubscribeCalendarBox({
  token,
  origin,
}: {
  token: string;
  origin: string;
}) {
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const httpsUrl = `${origin}/api/calendar/${currentToken}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  function copy() {
    navigator.clipboard.writeText(httpsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function regenerate() {
    startTransition(async () => {
      try {
        const next = await regenerateCalendarToken();
        setCurrentToken(next);
        toast.success("Calendar link regenerated. The old link no longer works.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input readOnly value={httpsUrl} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={webcalUrl}>
            <ExternalLinkIcon /> Add to Calendar app
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={isPending}
          onClick={regenerate}
        >
          <RefreshCwIcon /> Regenerate link
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Subscribing (not just a one-time import) keeps this in sync as
        sessions are proposed, confirmed, or cancelled. In Outlook or Apple
        Calendar, &quot;Add to Calendar app&quot; works directly. In Google
        Calendar, use Other calendars → From URL and paste the link above.
      </p>
    </div>
  );
}
