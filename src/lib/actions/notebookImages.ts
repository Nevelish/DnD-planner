"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM } from "@/lib/permissions";
import { loadPictureInventory } from "@/lib/notebookImages";
import { UserError } from "@/lib/userError";

const picturesPath = (campaignId: string) => `/campaigns/${campaignId}/notes/pictures`;

/** The DM removes a picture from their notebook or the party notebook.
 * Players' private pictures can't be removed this way. */
export async function deleteNotebookImage(campaignId: string, imageId: string) {
  await requireDM(campaignId);
  const { count } = await prisma.notebookImage.deleteMany({
    where: { id: imageId, campaignId, kind: { in: ["DM", "PARTY"] } },
  });
  if (count === 0) throw new UserError("That picture was already removed.");
  revalidatePath(picturesPath(campaignId));
}

/** Clears out every picture in the DM's and party notebooks that no page
 * uses any more, including players' private pages. Returns how many were
 * removed. */
export async function deleteUnusedNotebookImages(campaignId: string) {
  await requireDM(campaignId);
  const { pictures } = await loadPictureInventory(campaignId);
  const unused = pictures.filter((p) => p.usedOn.length === 0 && !p.usedPrivately).map((p) => p.id);
  const { count } = await prisma.notebookImage.deleteMany({
    where: { id: { in: unused }, campaignId, kind: { in: ["DM", "PARTY"] } },
  });
  revalidatePath(picturesPath(campaignId));
  return { removed: count };
}
