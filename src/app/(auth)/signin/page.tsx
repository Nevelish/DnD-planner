import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/components/auth/signin-form";
import { DiscordButton } from "@/components/auth/discord-button";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const discordEnabled = !!process.env.DISCORD_CLIENT_ID;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back, adventurer.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-6">
        <SignInForm callbackUrl={callbackUrl} />
        {discordEnabled && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>
            <DiscordButton callbackUrl={callbackUrl} />
          </>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={callbackUrl ? `/signup?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signup"}
            className="font-medium text-foreground underline"
          >
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
