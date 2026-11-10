import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
