import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export const adminSetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
});

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
