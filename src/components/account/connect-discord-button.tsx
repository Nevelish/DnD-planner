"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

/** Links a Discord account to the signed-in planner account. They keep
 * signing in however they do now; the email addresses don't have to match. */
export function ConnectDiscordButton({ callbackUrl = "/account" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-fit"
      onClick={() => signIn("discord", { callbackUrl })}
    >
      Connect Discord
    </Button>
  );
}
