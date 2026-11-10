import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <span className="text-5xl">🗺️</span>
      <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p className="max-w-sm text-muted-foreground">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
