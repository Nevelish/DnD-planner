"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/permissions";
import type { CampaignNoteType } from "@prisma/client";

const MAX_NOTE_LENGTH = 100_000;

const CONFLICT_MESSAGE =
  "This note was changed by someone else since you loaded it. Reload the page to see their version, then make your edit again.";

/**
 * Optimistic-concurrency save shared by both note upsert actions below.
 * expectedUpdatedAt is the updatedAt the editor last loaded (undefined if
 * no note existed yet). A conditional update keyed on that timestamp — or
 * a plain create guarded against a unique-constraint race — means a save
 * that started from stale content is rejected instead of silently
 * clobbering whatever was written in between. Returns the new
 * updatedAt so the editor can save again without re-fetching.
 */
async function saveWithConflictCheck(
  create: () => Prisma.PrismaPromise<{ updatedAt: Date }>,
  updateMany: (expectedUpdatedAt: Date) => Prisma.PrismaPromise<{ count: number }>,
  findUpdatedAt: () => Prisma.PrismaPromise<{ updatedAt: Date } | null>,
  expectedUpdatedAt: Date | undefined,
) {
  if (!expectedUpdatedAt) {
    try {
      return await create();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error(CONFLICT_MESSAGE);
      }
      throw e;
    }
  }

  const result = await updateMany(expectedUpdatedAt);
  if (result.count === 0) {
    throw new Error(CONFLICT_MESSAGE);
  }
  const updated = await findUpdatedAt();
  if (!updated) {
    throw new Error(CONFLICT_MESSAGE);
  }
  return updated;
}

export async function upsertCampaignNote(
  campaignId: string,
  type: CampaignNoteType,
  formData: FormData,
) {
  const content = String(formData.get("content") ?? "");
  if (content.length > MAX_NOTE_LENGTH) {
    throw new Error("That note is too long.");
  }
  const expectedUpdatedAtRaw = formData.get("expectedUpdatedAt");
  const expectedUpdatedAt = expectedUpdatedAtRaw
    ? new Date(String(expectedUpdatedAtRaw))
    : undefined;

  // Only the shared party note is still saved here: the DM's own notes
  // moved to the DM notebook (DmPage), so the legacy types are refused.
  if (type !== "PARTY") {
    throw new Error("These notes now live in the DM notebook.");
  }
  const membership = await requireMember(campaignId);

  const saved = await saveWithConflictCheck(
    () =>
      prisma.campaignNote.create({
        data: { campaignId, type, content, authorId: membership.userId },
        select: { updatedAt: true },
      }),
    (expected) =>
      prisma.campaignNote.updateMany({
        where: { campaignId, type, updatedAt: expected },
        data: { content, authorId: membership.userId },
      }),
    () =>
      prisma.campaignNote.findUnique({
        where: { campaignId_type: { campaignId, type } },
        select: { updatedAt: true },
      }),
    expectedUpdatedAt,
  );

  revalidatePath(`/campaigns/${campaignId}/notes`);
  return { updatedAt: saved.updatedAt.toISOString() };
}

export async function upsertPlayerNote(
  campaignId: string,
  formData: FormData,
): Promise<{ updatedAt: string }> {
  // Players' private notes moved to their own notebook (NotebookPage); the
  // old single note is kept read-only in the database, never written.
  void formData;
  await requireMember(campaignId);
  throw new Error("Your notes now live in your notebook. Reload the page.");
}
