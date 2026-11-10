import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";

export default async function NotificationsPage() {
  const userId = await requireUserId();
  const notifications = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <MarkAllReadButton />
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground">No notifications yet.</p>
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y p-0">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/notifications"}
                className="flex flex-col gap-0.5 px-4 py-3 hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={n.isRead ? "font-normal" : "font-semibold"}>
                    {n.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                  </span>
                </div>
                {n.body && (
                  <span className="text-sm text-muted-foreground">{n.body}</span>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
