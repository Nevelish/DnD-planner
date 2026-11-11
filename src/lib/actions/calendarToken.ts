"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";

export async function regenerateCalendarToken() {
  const userId = await requireUserId();
  const calendarToken = nanoid(32);
  await prisma.user.update({ where: { id: userId }, data: { calendarToken } });
  revalidatePath("/calendar");
  return calendarToken;
}
