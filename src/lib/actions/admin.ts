"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { publicUrlSchema } from "@/lib/validations/admin";

export type ActionResult = { error?: string; success?: boolean };

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
