"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/permissions";
import { groupToday } from "@/lib/away";
import { UserError } from "@/lib/userError";

const MAX_UPCOMING_PERIODS = 30;
const MAX_LENGTH_DAYS = 366;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start and end date.")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Pick a valid date.");

const awaySchema = z
  .object({
    startsOn: day,
    endsOn: day,
    note: z.string().trim().max(100, "Keep the note under 100 characters.").optional(),
  })
  .refine((v) => v.endsOn >= v.startsOn, "The last day can't be before the first.")
  .refine(
    (v) => (new Date(v.endsOn).getTime() - new Date(v.startsOn).getTime()) / 86_400_000 < MAX_LENGTH_DAYS,
    "Away dates can cover at most a year.",
  );

async function requireSignedIn() {
  const userId = await getCurrentUserId();
  if (!userId) throw new UserError("You must be signed in.");
  return userId;
}

/** Adds days the signed-in user can't play. They belong to the person, so
 * every campaign they're in sees them. */
export async function addAwayPeriod(formData: FormData) {
  const userId = await requireSignedIn();
  const parsed = awaySchema.safeParse({
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) {
    throw new UserError(parsed.error.issues[0]?.message ?? "Pick a start and end date.");
  }
  const { startsOn, endsOn, note } = parsed.data;
  const today = groupToday();
  if (endsOn < today) {
    throw new UserError("Those days are already over.");
  }

  const upcoming = await prisma.awayPeriod.count({ where: { userId, endsOn: { gte: new Date(today) } } });
  if (upcoming >= MAX_UPCOMING_PERIODS) {
    throw new UserError("That's a lot of away dates already. Remove some first.");
  }

  await prisma.awayPeriod.create({
    data: { userId, startsOn: new Date(startsOn), endsOn: new Date(endsOn), note: note || null },
  });
  revalidatePath("/", "layout");
}

/** Removes one of the signed-in user's own away periods. */
export async function removeAwayPeriod(periodId: string) {
  const userId = await requireSignedIn();
  const { count } = await prisma.awayPeriod.deleteMany({ where: { id: periodId, userId } });
  if (count === 0) {
    throw new UserError("Those away dates were already removed.");
  }
  revalidatePath("/", "layout");
}
