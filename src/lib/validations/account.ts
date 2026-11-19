import { z } from "zod";

export const dateTimeFormatSchema = z.object({
  timeFormat: z.enum(["HOUR_12", "HOUR_24"]),
  dateFormat: z.enum(["DMY", "MDY"]),
});

export const discordUserIdSchema = z.object({
  discordUserId: z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, "That doesn't look like a Discord user ID.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});
