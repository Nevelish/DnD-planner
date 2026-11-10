"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { markAllRead } from "@/lib/actions/notification";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markAllRead();
          router.refresh();
        })
      }
    >
      Mark all read
    </Button>
  );
}
