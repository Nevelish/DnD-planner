"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";

export async function listNotifications(limit = 20) {
  const userId = await requireUserId();
  return prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadNotificationCount() {
  const userId = await requireUserId();
  return prisma.notification.count({
    where: { recipientId: userId, isRead: false },
  });
}

export async function markRead(notificationId: string) {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function markAllRead() {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { recipientId: userId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}

export async function clearAllNotifications() {
  const userId = await requireUserId();
  await prisma.notification.deleteMany({ where: { recipientId: userId } });
  revalidatePath("/notifications");
}
