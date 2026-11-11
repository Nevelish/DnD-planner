import { z } from "zod";

export const proposalSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    startsAt: z.coerce.date({ message: "Pick a valid start date and time." }),
    // The DM picks a start and end time (same datetime-local control for
    // both); duration is derived from the difference rather than entered
    // directly, since a plain minutes field with a step increment made
    // some durations impossible to type (e.g. 190 with a step of 15).
    endsAt: z.coerce
      .date({ message: "Pick a valid end date and time." })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endsAt && data.endsAt <= data.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after the start time.",
        path: ["endsAt"],
      });
    }
  })
  .transform((data) => ({
    title: data.title,
    startsAt: data.startsAt,
    durationMinutes: data.endsAt
      ? Math.round((data.endsAt.getTime() - data.startsAt.getTime()) / 60_000)
      : undefined,
  }));

export type ProposalInput = z.infer<typeof proposalSchema>;

export const rsvpSchema = z.object({
  status: z.enum(["YES", "NO"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});
