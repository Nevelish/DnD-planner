"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function ConnectDiscordButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-fit"
      onClick={() => signIn("discord", { callbackUrl: "/account" })}
    >
      Connect Discord
    </Button>
  );
}
