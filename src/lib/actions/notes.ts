"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM } from "@/lib/permissions";
import type { CampaignNoteType } from "@prisma/client";

export async function upsertCampaignNote(
  campaignId: string,
  type: CampaignNoteType,
  formData: FormData,
) {
  const dm = await requireDM(campaignId);
  const content = String(formData.get("content") ?? "");

  await prisma.campaignNote.upsert({
    where: { campaignId_type: { campaignId, type } },
    create: { campaignId, type, content, authorId: dm.userId },
    update: { content, authorId: dm.userId },
  });

  revalidatePath(`/campaigns/${campaignId}/notes`);
}
