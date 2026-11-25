"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId, requireDM } from "@/lib/permissions";
import { addPlayerToCampaign } from "@/lib/membership";
import { recordRsvp, rsvpNeedsReason } from "@/lib/rsvp";
import { readJoinToken } from "@/lib/discord/joinLink";
import { linkedDiscordId } from "@/lib/discord/accounts";
import { UserError } from "@/lib/userError";

/**
 * Finishes what someone started by clicking a button in Discord before they
 * were in the campaign: joins them up as a player and saves their RSVP (or,
 * from a poll, sends them to vote). Only for the Discord account that clicked.
 */
export async function joinFromDiscord(token: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new UserError("Sign in first.");
  const data = readJoinToken(token);
  if (!data) throw new UserError("This link has expired. Click the button in Discord again for a new one.");
  if ((await linkedDiscordId(userId)) !== data.discordId) {
    throw new UserError("You're signed in with a different Discord account than the one that clicked the button.");
  }

  const membership = await addPlayerToCampaign(data.campaignId, userId);
  revalidatePath(`/campaigns/${data.campaignId}`);
  // From a poll's Vote button: they vote on the poll's page.
  if (data.pollId !== undefined) {
    return { url: `/campaigns/${data.campaignId}/polls/${data.pollId}`, saved: false };
  }

  const url = `/campaigns/${data.campaignId}/sessions/${data.sessionId}`;
  if (membership.role === "DM") return { url, saved: false };
  // Backing out of a Yes needs a reason, which the session page asks for.
  if (await rsvpNeedsReason(data.sessionId, membership.id, data.status)) return { url, saved: false };

  await recordRsvp({ campaignId: data.campaignId, proposalId: data.sessionId, membership, status: data.status });
  revalidatePath(url);
  return { url, saved: true };
}

/** Stops the bot posting in the campaign's channel. Posts go back to the
 * webhook, if there is one. */
export async function disconnectDiscordChannel(campaignId: string) {
  await requireDM(campaignId);
  await prisma.campaign.update({ where: { id: campaignId }, data: { discordChannelId: null } });
  revalidatePath(`/campaigns/${campaignId}/settings`);
}

/** Whether an RSVP click from someone without an account creates one. */
export async function setDiscordAutoJoin(campaignId: string, enabled: boolean) {
  await requireDM(campaignId);
  await prisma.campaign.update({ where: { id: campaignId }, data: { discordAutoJoin: enabled } });
  revalidatePath(`/campaigns/${campaignId}/settings`);
}
