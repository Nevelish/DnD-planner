import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <span className="text-5xl">🎲</span>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
        Run your campaigns. Keep your party in sync.
      </h1>
      <p className="max-w-lg text-muted-foreground">
        Create campaigns, keep DM notes and session prep private, propose the
        next session date, and let your players RSVP — all in one place.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
