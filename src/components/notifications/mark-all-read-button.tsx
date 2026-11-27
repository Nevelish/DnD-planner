"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { markAllRead } from "@/lib/actions/notification";
import { Button } from "@/components/ui/button";
import { useRefreshBell } from "@/components/notifications/use-refresh-bell";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const refreshBell = useRefreshBell();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markAllRead();
          router.refresh();
          // The bell in the header keeps its own copy; update it too.
          await refreshBell();
        })
      }
    >
      Mark all read
    </Button>
  );
}
