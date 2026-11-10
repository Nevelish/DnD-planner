"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function DiscordButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => signIn("discord", { callbackUrl })}
    >
      Continue with Discord
    </Button>
  );
}
