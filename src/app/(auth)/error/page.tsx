import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUserId } from "@/lib/permissions";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const userId = await getCurrentUserId();

  // OAuthAccountNotLinked covers two different situations that Auth.js
  // doesn't distinguish by error code alone: signed out, it means an
  // account with that email already exists (the user should sign in the
  // normal way, then connect Discord from Account settings); signed in,
  // it means they tried to connect a Discord account already tied to a
  // *different* account on this server.
  const description =
    error === "OAuthAccountNotLinked"
      ? userId
        ? "That Discord account is already connected to a different account on this server."
        : "An account with this email already exists. Sign in with your email and password, then connect Discord from Account settings."
      : "Something went wrong while signing you in. Please try again.";

  const backHref = userId ? "/account" : "/signin";
  const backLabel = userId ? "Back to account" : "Back to sign in";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in error</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <Button asChild className="w-full">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
