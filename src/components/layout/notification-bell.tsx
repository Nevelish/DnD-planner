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
import { BELL_COUNT_KEY, BELL_LIST_KEY } from "@/components/notifications/use-refresh-bell";
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
    BELL_COUNT_KEY,
    unreadNotificationCount,
    { refreshInterval: 30_000 },
  );
  const { data: notifications, mutate: mutateList } = useSWR(
    BELL_LIST_KEY,
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
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        >
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
      {/* Never taller than the room below the bell: the list scrolls, and the
          heading and "View all" stay put (on a small laptop screen, ten
          notifications don't fit). */}
      <DropdownMenuContent
        align="end"
        className="flex max-h-(--radix-dropdown-menu-content-available-height) w-80 flex-col"
      >
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
        <div className="min-h-0 flex-1 overflow-y-auto">
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
                    <span className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{n.body}</span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
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
