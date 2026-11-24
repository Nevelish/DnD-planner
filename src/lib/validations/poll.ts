import { z } from "zod";

export const MAX_POLL_OPTIONS = 10;

export const createPollSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    durationMinutes: z.coerce.number().int().min(30).max(24 * 60),
    options: z
      .array(z.coerce.date({ message: "Pick a valid date and time." }))
      .min(2, "Offer at least two dates to choose from.")
      .max(MAX_POLL_OPTIONS, `Offer at most ${MAX_POLL_OPTIONS} dates.`),
  })
  .superRefine((data, ctx) => {
    const times = data.options.map((d) => d.getTime());
    if (times.some((t) => Number.isNaN(t))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pick a valid date and time.", path: ["options"] });
    } else if (new Set(times).size !== times.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The same date is listed twice.", path: ["options"] });
    } else if (times.some((t) => t <= Date.now())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "All dates need to be in the future.", path: ["options"] });
    }
  });

export const pollVoteSchema = z.object({
  choice: z.enum(["YES", "MAYBE", "NO"]),
});

export const addPollOptionSchema = z.object({
  startsAt: z.coerce
    .date({ message: "Pick a valid date and time." })
    .refine((d) => d.getTime() > Date.now(), "Pick a date in the future."),
});
