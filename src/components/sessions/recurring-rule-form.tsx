"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  upsertRecurringRule,
  deactivateRecurringRule,
} from "@/lib/actions/recurringRule";
import { DAYS_OF_WEEK, WEEK_DISPLAY_ORDER } from "@/lib/validations/recurringRule";
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

/** Day-of-week (0=Sunday..6=Saturday) of a "YYYY-MM-DD" input value, read as
 * a local calendar date rather than UTC midnight (which `new Date(str)`
 * would do and could shift the day in some timezones). */
function dayOfWeekFromDateInput(value: string): number | null {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

export function RecurringRuleForm({
  campaignId,
  rule,
}: {
  campaignId: string;
  rule: RecurringRule | null;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(String(rule?.dayOfWeek ?? 1));
  const [dayOfWeekTouched, setDayOfWeekTouched] = useState(false);
  const [intervalWeeks, setIntervalWeeks] = useState(String(rule?.intervalWeeks ?? 2));
  const [leadTimeDays, setLeadTimeDays] = useState(String(rule?.leadTimeDays ?? 14));
  const [leadTimeTouched, setLeadTimeTouched] = useState(false);
  const [anchorDate, setAnchorDate] = useState(
    rule ? new Date(rule.anchorDate).toISOString().slice(0, 10) : "",
  );
  const [isPending, startTransition] = useTransition();

  function handleIntervalChange(value: string) {
    setIntervalWeeks(value);
    if (!leadTimeTouched) {
      const weeks = Number(value);
      if (Number.isFinite(weeks) && weeks > 0) {
        setLeadTimeDays(String(Math.min(60, weeks * 7)));
      }
    }
  }

  function handleLeadTimeChange(value: string) {
    setLeadTimeDays(value);
    setLeadTimeTouched(true);
  }

  function handleDayOfWeekChange(value: string) {
    setDayOfWeek(value);
    setDayOfWeekTouched(true);
  }

  /** Picking the first-occurrence date updates "Day of week" to match it,
   * so the two fields can't silently disagree (e.g. anchor date is a
   * Friday but the selector still says Monday, which would shift every
   * computed occurrence — including the first one — onto Mondays). A
   * manual day-of-week pick afterward still overrides this. */
  function handleAnchorDateChange(value: string) {
    setAnchorDate(value);
    if (!dayOfWeekTouched) {
      const computed = dayOfWeekFromDateInput(value);
      if (computed !== null) {
        setDayOfWeek(String(computed));
      }
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const timeStr = (form.elements.namedItem("timeOfDayInput") as HTMLInputElement)
      .value;
    if (!anchorDate || !timeStr) return;

    const [hours, minutes] = timeStr.split(":").map(Number);
    const timeOfDayMinutes = hours * 60 + minutes;

    const formData = new FormData(form);
    formData.set("anchorDate", `${anchorDate}T${timeStr}:00`);
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
              value={intervalWeeks}
              onChange={(e) => handleIntervalChange(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dayOfWeek">Day of week</Label>
            <Select value={dayOfWeek} onValueChange={handleDayOfWeekChange}>
              <SelectTrigger id="dayOfWeek">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_DISPLAY_ORDER.map((i) => (
                  <SelectItem key={i} value={String(i)}>
                    {DAYS_OF_WEEK[i]}
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
              value={leadTimeDays}
              onChange={(e) => handleLeadTimeChange(e.target.value)}
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
            value={anchorDate}
            onChange={(e) => handleAnchorDateChange(e.target.value)}
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
