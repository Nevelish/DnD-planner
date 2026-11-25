"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/lib/permissions";
import { recordRsvp } from "@/lib/rsvp";

export async function respond(
  campaignId: string,
  proposalId: string,
  status: "YES" | "MAYBE" | "NO",
  reason?: string,
) {
  const membership = await requireMember(campaignId);
  const rsvp = await recordRsvp({ campaignId, proposalId, membership, status, reason });

  revalidatePath(`/campaigns/${campaignId}/sessions/${proposalId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  return rsvp;
}
