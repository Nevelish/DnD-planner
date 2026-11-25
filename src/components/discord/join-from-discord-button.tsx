"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { joinFromDiscord } from "@/lib/actions/discord";
import { errorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";

export function JoinFromDiscordButton({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const { sessionUrl, saved } = await joinFromDiscord(token);
        toast.success(
          saved
            ? "Done! Next time, the buttons in Discord just work."
            : "You're in. Answer on the session page.",
        );
        router.push(sessionUrl);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <Button className="w-full" disabled={isPending} onClick={handleClick}>
      {isPending ? "Saving…" : label}
    </Button>
  );
}
