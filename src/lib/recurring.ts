import "server-only";
import { addWeeks, isBefore } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

// Matches ProposeSessionDialog's own default, used when there's no prior
// session on this rule yet to carry a duration forward from.
const DEFAULT_DURATION_MINUTES = 180;

/** The next date/time matching dayOfWeek + timeOfDayMinutes on/after `base`, in `timezone`. */
function computeOccurrenceOnOrAfter(
  base: Date,
  dayOfWeek: number,
  timeOfDayMinutes: number,
  timezone: string,
): Date {
  const zoned = toZonedTime(base, timezone);
  const daysToAdd = (dayOfWeek - zoned.getDay() + 7) % 7;
  const zonedTarget = new Date(zoned);
  zonedTarget.setDate(zoned.getDate() + daysToAdd);
  zonedTarget.setHours(Math.floor(timeOfDayMinutes / 60), timeOfDayMinutes % 60, 0, 0);
  return fromZonedTime(zonedTarget, timezone);
}

/**
 * Lazily generates the next DRAFT session proposal for a campaign's active
 * recurring rule, if one is due within its lead time window. Called from
 * page loads (dashboard, calendar, campaign overview) rather than a cron —
 * see plan's judgment calls for why.
 */
export async function ensureUpcomingProposals(campaignId: string) {
  const rule = await prisma.recurringRule.findFirst({
    where: { campaignId, isActive: true },
    include: { campaign: true },
  });
  if (!rule) return;

  const now = new Date();

  // If this rule already has a pending (not yet past, not cancelled)
  // proposal, there's nothing to do — generating is strictly "one at a
  // time" so repeated page loads don't spawn duplicate drafts.
  const pending = await prisma.sessionProposal.findFirst({
    where: {
      recurringRuleId: rule.id,
      status: { in: ["DRAFT", "PROPOSED", "CONFIRMED"] },
      startsAt: { gte: now },
    },
  });
  if (pending) return;

  const lastProposal = await prisma.sessionProposal.findFirst({
    where: { recurringRuleId: rule.id },
    orderBy: { startsAt: "desc" },
  });

  let nextOccurrence = lastProposal
    ? addWeeks(lastProposal.startsAt, rule.intervalWeeks)
    : computeOccurrenceOnOrAfter(
        rule.anchorDate,
        rule.dayOfWeek,
        rule.timeOfDayMinutes,
        rule.timezone,
      );

  // If nobody has opened the app in a while, fast-forward past missed slots
  // instead of backfilling every one of them.
  while (isBefore(nextOccurrence, now)) {
    nextOccurrence = addWeeks(nextOccurrence, rule.intervalWeeks);
  }

  const leadTimeCutoff = new Date(now);
  leadTimeCutoff.setDate(leadTimeCutoff.getDate() + rule.leadTimeDays);
  if (isBefore(leadTimeCutoff, nextOccurrence)) return;

  await prisma.sessionProposal.create({
    data: {
      campaignId,
      proposedById: rule.campaign.ownerId,
      startsAt: nextOccurrence,
      durationMinutes: lastProposal?.durationMinutes ?? DEFAULT_DURATION_MINUTES,
      status: "DRAFT",
      recurringRuleId: rule.id,
    },
  });

  await createNotification({
    recipientId: rule.campaign.ownerId,
    campaignId,
    type: "RECURRING_DRAFT_READY",
    title: `A draft session is ready for ${rule.campaign.name}`,
    link: `/campaigns/${campaignId}`,
  });
}
