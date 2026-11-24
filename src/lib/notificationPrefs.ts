import type { NotificationType } from "@prisma/client";

// Event types worth @mentioning players for on Discord — the "this affects
// your plans, go look" events. Deliberately excludes RSVP_CHANGED and
// SESSION_CONFIRMED: pinging on every RSVP, or on a session merely being
// locked in, would be exactly the noise the event filter exists to avoid.
export const MENTION_EVENT_TYPES: readonly NotificationType[] = [
  "SESSION_PROPOSED",
  "SESSION_RESCHEDULED",
  "SESSION_CANCELLED",
  "SESSION_REMINDER",
  "DATE_POLL_OPENED",
];

type PrefItem = { type: NotificationType; label: string };

/** What each person can switch on/off in Account → Notifications, grouped
 * the way they'll think about it. CAMPAIGN_INVITE isn't listed — nothing in
 * the app sends it yet. */
export const NOTIFICATION_PREF_GROUPS: { heading: string; items: PrefItem[] }[] = [
  {
    heading: "Sessions & party",
    items: [
      { type: "SESSION_PROPOSED", label: "New session proposed" },
      { type: "DATE_POLL_OPENED", label: "Date poll opened" },
      { type: "SESSION_RESCHEDULED", label: "Time or location changed" },
      { type: "SESSION_CONFIRMED", label: "Session confirmed" },
      { type: "SESSION_CANCELLED", label: "Session cancelled" },
      { type: "SESSION_REMINDER", label: "Reminder the day before" },
      { type: "RECAP_POSTED", label: "Session recap posted" },
      { type: "RSVP_CHANGED", label: "Someone's RSVP changes" },
      { type: "SAFETY_TOOL_ADDED", label: "A line or veil is added" },
    ],
  },
  {
    heading: "Campaigns you run",
    items: [
      { type: "MEMBER_JOINED", label: "A player joins" },
      { type: "MEMBER_LEFT", label: "A player leaves" },
      { type: "RECURRING_DRAFT_READY", label: "Recurring draft ready to review" },
    ],
  },
];

export const NOTIFICATION_PREF_TYPES: NotificationType[] = NOTIFICATION_PREF_GROUPS.flatMap(
  (g) => g.items.map((i) => i.type),
);
