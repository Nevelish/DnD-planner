"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { D20Icon } from "@/components/icons/d20-icon";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <D20Icon className="size-12 text-primary" strokeWidth={1} />
      <h1 className="font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
