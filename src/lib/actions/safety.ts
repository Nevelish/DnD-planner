"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireDM, requireMember } from "@/lib/permissions";
import { notifyCampaignMembers } from "@/lib/notifications";
import { SESSION_ZERO_QUESTIONS } from "@/lib/sessionZero";

const MAX_ENTRIES_PER_CAMPAIGN = 200;

const safetyEntrySchema = z.object({
  kind: z.enum(["LINE", "VEIL"], { message: "Pick line or veil." }),
  text: z
    .string()
    .trim()
    .min(1, "Write what it's about.")
    .max(200, "Keep it under 200 characters."),
});

/** Adds a line or veil. Anonymous: the author is stored only so they can
 * remove it again, and is never shown or included in the notification. */
export async function addSafetyEntry(campaignId: string, formData: FormData) {
  const membership = await requireMember(campaignId);
  const parsed = safetyEntrySchema.safeParse({
    kind: formData.get("kind"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const count = await prisma.safetyEntry.count({ where: { campaignId } });
  if (count >= MAX_ENTRIES_PER_CAMPAIGN) {
    throw new Error("This campaign's list is full. Remove an old entry first.");
  }

  await prisma.safetyEntry.create({
    data: { campaignId, authorId: membership.userId, ...parsed.data },
  });

  // In-app only: SAFETY_TOOL_ADDED is never posted to Discord.
  await notifyCampaignMembers(campaignId, {
    type: "SAFETY_TOOL_ADDED",
    title: parsed.data.kind === "LINE" ? "A new line was added" : "A new veil was added",
    body: `“${parsed.data.text}”`,
    link: `/campaigns/${campaignId}/safety`,
    excludeUserId: membership.userId,
  });

  revalidatePath(`/campaigns/${campaignId}/safety`);
}

/** The author can remove their own entry; the DM can remove any (e.g. to
 * tidy up duplicates). */
export async function removeSafetyEntry(campaignId: string, entryId: string) {
  const membership = await requireMember(campaignId);
  const { count } = await prisma.safetyEntry.deleteMany({
    where: {
      id: entryId,
      campaignId,
      ...(membership.role === "DM" ? {} : { authorId: membership.userId }),
    },
  });
  if (count === 0) {
    throw new Error("You can only remove entries you added.");
  }
  revalidatePath(`/campaigns/${campaignId}/safety`);
}

export async function saveSessionZero(campaignId: string, formData: FormData) {
  await requireDM(campaignId);

  const answers: Record<string, string> = {};
  for (const { key, label } of SESSION_ZERO_QUESTIONS) {
    const value = String(formData.get(key) ?? "").replace(/\r\n?/g, "\n").trim();
    if (value.length > 1000) {
      throw new Error(`"${label}" must be 1000 characters or fewer.`);
    }
    if (value) answers[key] = value;
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sessionZero: Object.keys(answers).length > 0 ? answers : Prisma.DbNull },
  });
  revalidatePath(`/campaigns/${campaignId}/safety`);
}
