import { z } from "zod";

export const characterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  class: z.string().trim().min(1, "Class is required").max(60),
  level: z.coerce.number().int().min(1).max(20),
  race: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  discordUserId: z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, "That doesn't look like a Discord user ID.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});

export type CharacterInput = z.infer<typeof characterSchema>;
