"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateDiscordUserId } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DiscordIdForm({
  discordUserId,
  discordLinked,
}: {
  discordUserId: string | null;
  discordLinked: boolean;
}) {
  const [value, setValue] = useState(discordUserId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const formData = new FormData();
    formData.set("discordUserId", value);

    startTransition(async () => {
      try {
        await updateDiscordUserId(formData);
        toast.success("Discord user ID saved.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="discordUserId">Discord user ID</Label>
      <Input
        id="discordUserId"
        inputMode="numeric"
        placeholder="e.g. 1234567890123456"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className="text-sm text-muted-foreground">
        {discordLinked
          ? "Set automatically from your Discord sign-in. You'll be @mentioned in Discord when a session is proposed or cancelled, in any campaign with a Discord webhook. Clear it to opt out."
          : "Set this to be @mentioned in Discord when a session is proposed or cancelled, in any campaign with a Discord webhook. Signing in with Discord fills this in for you automatically — or find yours in Discord under Settings → Advanced → Enable Developer Mode, then right-click your name and Copy User ID."}
      </p>
      <Button onClick={handleSave} disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
