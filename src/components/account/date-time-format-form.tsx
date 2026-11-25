"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateDateTimeFormat } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimeFormat, DateFormat } from "@prisma/client";
import { errorMessage } from "@/lib/userError";

export function DateTimeFormatForm({
  timeFormat,
  dateFormat,
}: {
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
}) {
  const [time, setTime] = useState<TimeFormat>(timeFormat);
  const [date, setDate] = useState<DateFormat>(dateFormat);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const formData = new FormData();
    formData.set("timeFormat", time);
    formData.set("dateFormat", date);

    startTransition(async () => {
      try {
        await updateDateTimeFormat(formData);
        toast.success("Date & time format saved.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="timeFormat">Clock</Label>
        <Select value={time} onValueChange={(v) => setTime(v as TimeFormat)}>
          <SelectTrigger id="timeFormat" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HOUR_24">24-hour — 18:00</SelectItem>
            <SelectItem value="HOUR_12">12-hour — 6:00 PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateFormat">Date order</Label>
        <Select value={date} onValueChange={(v) => setDate(v as DateFormat)}>
          <SelectTrigger id="dateFormat" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DMY">Day first — 20 November 2026 (Norwegian/European)</SelectItem>
            <SelectItem value="MDY">Month first — November 20, 2026 (US)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleSave} disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
