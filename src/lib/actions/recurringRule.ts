"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireDM } from "@/lib/permissions";
import { recurringRuleSchema } from "@/lib/validations/recurringRule";

export async function upsertRecurringRule(campaignId: string, formData: FormData) {
  await requireDM(campaignId);

  const parsed = recurringRuleSchema.safeParse({
    intervalWeeks: formData.get("intervalWeeks"),
    dayOfWeek: formData.get("dayOfWeek"),
    timeOfDayMinutes: formData.get("timeOfDayMinutes"),
    timezone: formData.get("timezone"),
    anchorDate: formData.get("anchorDate"),
    leadTimeDays: formData.get("leadTimeDays"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.recurringRule.updateMany({
      where: { campaignId, isActive: true },
      data: { isActive: false },
    });
    await tx.recurringRule.create({
      data: {
        campaignId,
        frequency: parsed.data.intervalWeeks === 1 ? "WEEKLY" : "CUSTOM_INTERVAL",
        intervalWeeks: parsed.data.intervalWeeks,
        dayOfWeek: parsed.data.dayOfWeek,
        timeOfDayMinutes: parsed.data.timeOfDayMinutes,
        timezone: parsed.data.timezone,
        anchorDate: parsed.data.anchorDate,
        leadTimeDays: parsed.data.leadTimeDays,
        isActive: true,
      },
    });
  });

  revalidatePath(`/campaigns/${campaignId}/settings`);
}

export async function deactivateRecurringRule(campaignId: string, ruleId: string) {
  await requireDM(campaignId);
  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  });
  revalidatePath(`/campaigns/${campaignId}/settings`);
}
