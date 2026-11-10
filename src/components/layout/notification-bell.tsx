"use client";

import Link from "next/link";
import useSWR from "swr";
import { BellIcon } from "lucide-react";

import {
  listNotifications,
  markAllRead,
  markRead,
  unreadNotificationCount,
} from "@/lib/actions/notification";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationBell() {
  const { data: count, mutate: mutateCount } = useSWR(
    "unread-notification-count",
    unreadNotificationCount,
    { refreshInterval: 30_000 },
  );
  const { data: notifications, mutate: mutateList } = useSWR(
    "recent-notifications",
    () => listNotifications(10),
  );

  async function handleOpenChange(open: boolean) {
    if (open) {
      await Promise.all([mutateCount(), mutateList()]);
    }
  }

  async function handleMarkAllRead() {
    await markAllRead();
    await Promise.all([mutateCount(), mutateList()]);
  }

  async function handleItemClick(id: string) {
    await markRead(id);
    await mutateCount();
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <BellIcon />
          {!!count && count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {!!count && count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-normal text-muted-foreground underline"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!notifications || notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              asChild
              className="flex-col items-start gap-0.5"
              onSelect={() => handleItemClick(n.id)}
            >
              <Link href={n.link ?? "/notifications"}>
                <span className={n.isRead ? "font-normal" : "font-semibold"}>
                  {n.title}
                </span>
                {n.body && (
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/notifications" className="justify-center text-sm">
            View all
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
