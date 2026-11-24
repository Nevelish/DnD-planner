import { z } from "zod";

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .nullish()
    // Browsers submit textarea line breaks as \r\n; store plain \n.
    .transform((v) => (v ? v.replace(/\r\n?/g, "\n") : null));
}

export const proposalSchema = z
  .object({
    // Empty fields become null rather than undefined so that clearing a
    // field in the edit dialog actually clears it in the database.
    title: optionalText("Title", 120),
    startsAt: z.coerce.date({ message: "Pick a valid start date and time." }),
    // The DM picks a start and end time (same datetime-local control for
    // both); duration is derived from the difference rather than entered
    // directly, since a plain minutes field with a step increment made
    // some durations impossible to type (e.g. 190 with a step of 15).
    endsAt: z.coerce
      .date({ message: "Pick a valid end date and time." })
      .optional(),
    format: z.enum(["IN_PERSON", "ONLINE"]).nullable().catch(null),
    location: optionalText("Location", 200),
    description: optionalText("Description", 2000),
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
    format: data.format,
    location: data.location,
    description: data.description,
    startsAt: data.startsAt,
    durationMinutes: data.endsAt
      ? Math.round((data.endsAt.getTime() - data.startsAt.getTime()) / 60_000)
      : undefined,
  }));

export type ProposalInput = z.infer<typeof proposalSchema>;

export const rsvpSchema = z.object({
  status: z.enum(["YES", "MAYBE", "NO"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});
