import "server-only";

import { prisma } from "@/lib/prisma";
import { notifyCampaignMembers } from "@/lib/notifications";
import { formatSessionDateTimeInTimeZone } from "@/lib/sessionDateFormat";
import { placeSuffix } from "@/lib/sessionPlace";
import { getServerTimeZone } from "@/lib/timezone";
import { getRequestOrigin } from "@/lib/requestOrigin";
import { recapExcerpt } from "@/lib/recap";

const REMINDER_LEAD_MS = 24 * 60 * 60_000;

/**
 * The reminderSentAt value for a session being announced (proposed,
 * published, or moved) right now. If it starts within the reminder window,
 * the announcement itself already serves as the heads-up — mark the
 * reminder as sent so players don't get a second ping minutes later.
 */
export function reminderSentAtFor(startsAt: Date): Date | null {
  const now = new Date();
  return startsAt.getTime() - now.getTime() <= REMINDER_LEAD_MS ? now : null;
}

/**
 * Sends the 24h-before reminder for every live session that's now inside
 * that window and hasn't had one yet. Goes to the DM and every player who
 * hasn't said No. Each session is claimed with a conditional update before
 * sending, so it's sent at most once even if two server instances run
 * this at the same time.
 */
export async function sendDueReminders() {
  const now = new Date();
  const due = await prisma.sessionProposal.findMany({
    where: {
      status: { in: ["PROPOSED", "CONFIRMED"] },
      reminderSentAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
    },
    include: {
      campaign: { select: { name: true, members: { select: { id: true, userId: true } } } },
      rsvps: { where: { status: "NO" }, select: { memberId: true } },
    },
  });

  for (const session of due) {
    const { count } = await prisma.sessionProposal.updateMany({
      where: { id: session.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (count === 0) continue;

    const declined = new Set(session.rsvps.map((r) => r.memberId));
    const recipients = session.campaign.members
      .filter((m) => !declined.has(m.id))
      .map((m) => m.userId);
    if (recipients.length === 0) continue;

    const when = `${formatSessionDateTimeInTimeZone(session.startsAt, getServerTimeZone())}${placeSuffix(session.format, session.location)} — ${session.campaign.name}`;
    const previously = await previouslyOn(session.campaignId, session.startsAt);
    await notifyCampaignMembers(session.campaignId, {
      type: "SESSION_REMINDER",
      title: `Reminder: ${session.title || "session"} coming up`,
      body: previously ? `${when}\nPreviously on…: ${previously.short}` : when,
      discordBody: previously ? `${when}\n\n${previously.discord}` : when,
      link: `/campaigns/${session.campaignId}/sessions/${session.id}`,
      onlyUserIds: recipients,
    });
  }
}

/**
 * A "previously on…" teaser for a reminder: the start of the latest recap
 * written before this session, so everyone remembers where things left off.
 * That's usually last session's; if nobody wrote one, an older one (Discord
 * says which session it's from). Null if there's no recap yet.
 */
async function previouslyOn(campaignId: string, before: Date) {
  const last = await prisma.sessionProposal.findFirst({
    where: { campaignId, status: "COMPLETED", startsAt: { lt: before }, recap: { not: null } },
    orderBy: { startsAt: "desc" },
    select: { id: true, title: true, startsAt: true, recap: true },
  });
  const short = recapExcerpt(last?.recap ?? "", 160);
  if (!last || !short) return null;

  const origin = await getRequestOrigin().catch(() => null);
  const name = `${last.title || "Last session"} (<t:${Math.floor(last.startsAt.getTime() / 1000)}:D>)`;
  const heading = origin ? `[${name}](${origin}/campaigns/${campaignId}/sessions/${last.id})` : name;
  return { short, discord: `**Previously on…** ${heading}\n> ${recapExcerpt(last.recap!, 400)}` };
}
