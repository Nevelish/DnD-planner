import { z } from "zod";

export const publicUrlSchema = z.object({
  publicUrl: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || /^https?:\/\/[^\s/]+$/.test(value), {
      message:
        "Enter a full URL like https://dnd.example.com (no trailing slash or path).",
    }),
});
