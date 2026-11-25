"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/permissions";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTime } from "@/lib/sessionDateFormat";
import { recapExcerpt } from "@/lib/recap";
import { UserError } from "@/lib/userError";

const MAX_RECAP_LENGTH = 50_000;

/**
 * Saves a session's recap. Anyone in the campaign can write it, so this
 * uses the same optimistic-concurrency check as party notes: the editor
 * sends the recapUpdatedAt it loaded, and the update only applies if
 * nobody has saved since — otherwise their version would be silently lost.
 */
export async function saveRecap(campaignId: string, proposalId: string, formData: FormData) {
  const membership = await requireMember(campaignId);

  const content = String(formData.get("content") ?? "").replace(/\r\n?/g, "\n");
  if (content.length > MAX_RECAP_LENGTH) {
    throw new UserError("That recap is too long.");
  }
  const expectedRaw = formData.get("expectedUpdatedAt");
  const expectedUpdatedAt = expectedRaw ? new Date(String(expectedRaw)) : null;

  const session = await prisma.sessionProposal.findFirst({
    where: { id: proposalId, campaignId },
    select: { status: true, recap: true, title: true, startsAt: true },
  });
  if (!session) {
    throw new UserError("Session not found.");
  }
  if (session.status !== "COMPLETED") {
    throw new UserError("A recap can be written once the session has been played.");
  }

  const recap = content.trim() ? content : null;
  const now = new Date();
  const { count } = await prisma.sessionProposal.updateMany({
    where: { id: proposalId, campaignId, recapUpdatedAt: expectedUpdatedAt },
    data: { recap, recapUpdatedAt: now, recapAuthorId: membership.userId },
  });
  if (count === 0) {
    throw new UserError(
      "Someone else changed this recap since you opened it. Reload the page to see their version, then make your edit again.",
    );
  }

  // Only the first time a recap appears is news; later edits are quiet.
  // (A concurrent first save fails the version check above, so this can't
  // fire twice.)
  if (!session.recap && recap) {
    const when = await formatSessionDateTime(session.startsAt);
    await notifyCampaignMembers(campaignId, {
      type: "RECAP_POSTED",
      title: `Recap posted: ${session.title || when}`,
      body: recapExcerpt(recap, 280),
      link: `/campaigns/${campaignId}/sessions/${proposalId}`,
      excludeUserId: membership.userId,
    });
  }

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}/sessions`);
  revalidatePath(`/campaigns/${campaignId}/log`);
  revalidatePath(`/campaigns/${campaignId}`);
  return { updatedAt: now.toISOString() };
}
