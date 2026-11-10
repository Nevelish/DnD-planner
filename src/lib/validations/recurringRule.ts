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

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
