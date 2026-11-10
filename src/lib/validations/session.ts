import { z } from "zod";

export const proposalSchema = z.object({
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  startsAt: z.coerce.date({ message: "Pick a valid date and time." }),
  durationMinutes: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional(),
});

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
