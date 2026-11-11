"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM, requireMember } from "@/lib/permissions";
import type { CampaignNoteType } from "@prisma/client";

const MAX_NOTE_LENGTH = 100_000;

export async function upsertCampaignNote(
  campaignId: string,
  type: CampaignNoteType,
  formData: FormData,
) {
  const content = String(formData.get("content") ?? "");
  if (content.length > MAX_NOTE_LENGTH) {
    throw new Error("That note is too long.");
  }

  // The party note is shared and editable by anyone in the campaign; the
  // DM's own notes (general/prep) stay DM-only, same as before.
  const membership =
    type === "PARTY" ? await requireMember(campaignId) : await requireDM(campaignId);

  await prisma.campaignNote.upsert({
    where: { campaignId_type: { campaignId, type } },
    create: { campaignId, type, content, authorId: membership.userId },
    update: { content, authorId: membership.userId },
  });

  revalidatePath(`/campaigns/${campaignId}/notes`);
}

export async function upsertPlayerNote(campaignId: string, formData: FormData) {
  const membership = await requireMember(campaignId);
  const content = String(formData.get("content") ?? "");
  if (content.length > MAX_NOTE_LENGTH) {
    throw new Error("That note is too long.");
  }

  await prisma.playerNote.upsert({
    where: { campaignId_userId: { campaignId, userId: membership.userId } },
    create: { campaignId, userId: membership.userId, content },
    update: { content },
  });

  revalidatePath(`/campaigns/${campaignId}/notes`);
}
