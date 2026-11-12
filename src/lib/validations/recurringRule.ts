import { z } from "zod";

export const recurringRuleSchema = z.object({
  intervalWeeks: z.coerce.number().int().min(1).max(52),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  timeOfDayMinutes: z.coerce.number().int().min(0).max(1439),
  timezone: z.string().trim().min(1, "Pick a timezone."),
  anchorDate: z.coerce.date(),
  leadTimeDays: z.coerce.number().int().min(1).max(60),
});

export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;

// Index = the real day-of-week value (matches JS's Date#getDay(), which the
// scheduling engine in lib/recurring.ts relies on) — don't reorder this.
export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Monday-first display order for the day-of-week picker. Purely a UI
// rendering order — values are still the real DAYS_OF_WEEK indices above.
export const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
