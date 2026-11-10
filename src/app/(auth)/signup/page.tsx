import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/signup-form";
import { DiscordButton } from "@/components/auth/discord-button";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const discordEnabled = !!process.env.DISCORD_CLIENT_ID;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Sign up once — you can DM one campaign and play in another, all from
          the same account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-6">
        <SignUpForm callbackUrl={callbackUrl} />
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
          Already have an account?{" "}
          <Link
            href={callbackUrl ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signin"}
            className="font-medium text-foreground underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
