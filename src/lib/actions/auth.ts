"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { requireUserId } from "@/lib/permissions";
import { changePasswordSchema, signUpSchema } from "@/lib/validations/auth";
import { clientIp, loginRetryAfterMs, recordLoginFailure } from "@/lib/loginRateLimit";

export type ActionResult = { error?: string; success?: boolean };

export async function signUpAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    return {
      success: true,
    };
  }

  return { success: true };
}

export async function changePasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) {
    return {
      error: "This account signs in with Discord and has no password to change.",
    };
  }

  // Same limit as signing in: the "current password" box is another place
  // to guess passwords.
  const ip = clientIp(await headers());
  if (user.email && loginRetryAfterMs(user.email, ip) > 0) {
    return { error: "Too many wrong passwords. Wait 15 minutes and try again." };
  }
  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    if (user.email) recordLoginFailure(user.email, ip);
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  // Bumping the version signs out every other device this account is
  // signed in on (e.g. if the old password leaked)...
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
  // ...and signing in again with the new password keeps this one signed in.
  if (user.email) {
    await signIn("credentials", {
      email: user.email,
      password: parsed.data.newPassword,
      redirect: false,
    });
  }

  // Load the page afresh rather than returning: the re-render Next does
  // after an action would still see the old (now invalid) session cookie
  // and bounce to the sign-in page. A redirect makes the browser come back
  // with the new one.
  redirect("/account?password=changed");
}

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "too_many_attempts") {
      return {
        error: "Too many failed sign-in attempts. Wait 15 minutes and try again, or ask your admin to reset your password.",
      };
    }
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }

  return { success: true };
}
