"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import {
  adminSetPasswordSchema,
  createUserSchema,
  publicUrlSchema,
} from "@/lib/validations/admin";

export type ActionResult = { error?: string; success?: boolean };

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
}) {
  await requireAdmin();

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    throw new Error("An account with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: input.isAdmin ? "ADMIN" : "USER",
    },
  });

  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, role: "ADMIN" | "USER") {
  await requireAdmin();

  if (role === "USER") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", NOT: { id: userId } },
    });
    if (otherAdmins === 0) {
      throw new Error("At least one admin must remain.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  const adminId = await requireAdmin();

  if (disabled && userId === adminId) {
    throw new Error("You can't disable your own account.");
  }

  await prisma.user.update({ where: { id: userId }, data: { disabled } });
  revalidatePath("/admin/users");
}

export async function adminResetPassword(userId: string, newPassword: string) {
  await requireAdmin();

  const parsed = adminSetPasswordSchema.safeParse({ newPassword });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) {
    throw new Error(
      "This account signs in with Discord and has no password to reset.",
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function updatePublicUrlAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = publicUrlSchema.safeParse({
    publicUrl: formData.get("publicUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const publicUrl = parsed.data.publicUrl || null;

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", publicUrl },
    update: { publicUrl },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
