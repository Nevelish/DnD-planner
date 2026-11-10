"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  upsertRecurringRule,
  deactivateRecurringRule,
} from "@/lib/actions/recurringRule";
import { DAYS_OF_WEEK } from "@/lib/validations/recurringRule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RecurringRule } from "@prisma/client";

function minutesToTimeInput(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function RecurringRuleForm({
  campaignId,
  rule,
}: {
  campaignId: string;
  rule: RecurringRule | null;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(String(rule?.dayOfWeek ?? 6));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const anchorDateStr = (form.elements.namedItem("anchorDateInput") as HTMLInputElement)
      .value;
    const timeStr = (form.elements.namedItem("timeOfDayInput") as HTMLInputElement)
      .value;
    if (!anchorDateStr || !timeStr) return;

    const [hours, minutes] = timeStr.split(":").map(Number);
    const timeOfDayMinutes = hours * 60 + minutes;

    const formData = new FormData(form);
    formData.set("anchorDate", `${anchorDateStr}T${timeStr}:00`);
    formData.set("timeOfDayMinutes", String(timeOfDayMinutes));
    formData.set("dayOfWeek", dayOfWeek);
    formData.set(
      "timezone",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );

    startTransition(async () => {
      try {
        await upsertRecurringRule(campaignId, formData);
        toast.success("Recurring schedule saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleTurnOff() {
    if (!rule) return;
    startTransition(async () => {
      try {
        await deactivateRecurringRule(campaignId, rule.id);
        toast.success("Recurring sessions turned off.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {rule
          ? `Currently repeating every ${rule.intervalWeeks === 1 ? "week" : `${rule.intervalWeeks} weeks`} on ${DAYS_OF_WEEK[rule.dayOfWeek]}s. The app drafts the next session automatically — review and send it to the party from the campaign overview.`
          : "Set a cadence and the app will draft the next session date for you automatically, ahead of time."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intervalWeeks">Repeat every (weeks)</Label>
            <Input
              id="intervalWeeks"
              name="intervalWeeks"
              type="number"
              min={1}
              max={52}
              defaultValue={rule?.intervalWeeks ?? 2}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dayOfWeek">Day of week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger id="dayOfWeek">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day, i) => (
                  <SelectItem key={day} value={String(i)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timeOfDayInput">Time</Label>
            <Input
              id="timeOfDayInput"
              name="timeOfDayInput"
              type="time"
              defaultValue={
                rule ? minutesToTimeInput(rule.timeOfDayMinutes) : "19:00"
              }
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leadTimeDays">Draft how many days ahead</Label>
            <Input
              id="leadTimeDays"
              name="leadTimeDays"
              type="number"
              min={1}
              max={60}
              defaultValue={rule?.leadTimeDays ?? 14}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="anchorDateInput">First occurrence</Label>
          <Input
            id="anchorDateInput"
            name="anchorDateInput"
            type="date"
            defaultValue={
              rule
                ? new Date(rule.anchorDate).toISOString().slice(0, 10)
                : undefined
            }
            required
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending} className="w-fit">
            {rule ? "Update schedule" : "Enable recurring sessions"}
          </Button>
          {rule && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleTurnOff}
            >
              Turn off
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
