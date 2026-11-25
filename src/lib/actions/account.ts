"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import { dateTimeFormatSchema, discordUserIdSchema } from "@/lib/validations/account";
import { MENTION_EVENT_TYPES, NOTIFICATION_PREF_TYPES } from "@/lib/notificationPrefs";
import { UserError } from "@/lib/userError";

export async function updateDateTimeFormat(formData: FormData) {
  const userId = await requireUserId();

  const parsed = dateTimeFormatSchema.safeParse({
    timeFormat: formData.get("timeFormat"),
    dateFormat: formData.get("dateFormat"),
  });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  revalidatePath("/account");
}

export async function updateDiscordUserId(formData: FormData) {
  const userId = await requireUserId();

  const parsed = discordUserIdSchema.safeParse({
    discordUserId: formData.get("discordUserId"),
  });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  revalidatePath("/account");
}

/** Saves which notifications this person wants. The form sends the types
 * that are switched ON; everything else on the list is stored as muted, so
 * unknown values are simply ignored rather than trusted. */
export async function updateNotificationPrefs(formData: FormData) {
  const userId = await requireUserId();

  const inApp = new Set(formData.getAll("inApp").map(String));
  const mention = new Set(formData.getAll("mention").map(String));

  await prisma.user.update({
    where: { id: userId },
    data: {
      mutedNotificationTypes: NOTIFICATION_PREF_TYPES.filter((t) => !inApp.has(t)),
      mutedMentionTypes: MENTION_EVENT_TYPES.filter((t) => !mention.has(t)),
    },
  });
  revalidatePath("/account");
}
