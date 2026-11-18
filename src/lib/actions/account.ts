"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { dateTimeFormatSchema } from "@/lib/validations/account";

export async function updateDateTimeFormat(formData: FormData) {
  const userId = await requireUserId();

  const parsed = dateTimeFormatSchema.safeParse({
    timeFormat: formData.get("timeFormat"),
    dateFormat: formData.get("dateFormat"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  revalidatePath("/account");
}
