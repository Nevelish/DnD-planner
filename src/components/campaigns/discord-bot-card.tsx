"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLinkIcon } from "lucide-react";

import { disconnectDiscordChannel, setDiscordAutoJoin } from "@/lib/actions/discord";
import { errorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";

export function DiscordBotCard({
  campaignId,
  channelLabel,
  autoJoin,
  inviteUrl,
}: {
  campaignId: string;
  /** "#game-night", or the channel id if Discord didn't say; null if not connected. */
  channelLabel: string | null;
  autoJoin: boolean;
  inviteUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [autoJoinOn, setAutoJoinOn] = useState(autoJoin);

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  if (!channelLabel) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Let players answer from Discord: the bot posts sessions in a channel with{" "}
          <span className="font-medium text-foreground">I&apos;m in / Maybe / Can&apos;t make it</span>{" "}
          buttons, and keeps the answers on the post up to date.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
              Add the bot to your server
            </a>{" "}
            (once).
          </li>
          <li>
            In the channel you want, type <code className="rounded bg-muted px-1">/planner connect</code> and pick
            this campaign. You need to have signed in here with Discord.
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Posting in <span className="font-medium">{channelLabel}</span>, with RSVP buttons.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => run(() => disconnectDiscordChannel(campaignId), "Disconnected from Discord.")}
        >
          Disconnect
        </Button>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={autoJoinOn}
          disabled={isPending}
          onChange={(e) => {
            const enabled = e.target.checked;
            setAutoJoinOn(enabled);
            run(
              () => setDiscordAutoJoin(campaignId, enabled),
              enabled ? "People in the channel can now join by answering." : "Joining from Discord now needs a sign-in.",
            );
          }}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Let anyone in the channel join by answering</span>
          <span className="text-muted-foreground">
            Someone without an account who clicks an RSVP button is added as a player straight away,
            no sign-in needed. Only turn this on if everyone in the channel plays in this campaign.
            When it&apos;s off, they get a link to join with Discord first.
          </span>
        </span>
      </label>

      <a
        href={inviteUrl}
        target="_blank"
        rel="noreferrer"
        className="flex w-fit items-center gap-1 text-muted-foreground underline underline-offset-2"
      >
        Add the bot to another server <ExternalLinkIcon className="size-3.5" />
      </a>
    </div>
  );
}
