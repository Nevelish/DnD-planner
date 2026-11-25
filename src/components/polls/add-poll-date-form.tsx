"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlusIcon } from "lucide-react";

import { addPollOption } from "@/lib/actions/poll";
import { localInputToISO } from "@/lib/localDateTimeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/userError";

export function AddPollDateForm({
  campaignId,
  pollId,
  isDM,
}: {
  campaignId: string;
  pollId: string;
  isDM: boolean;
}) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const iso = localInputToISO(value);
    if (!iso) {
      toast.error("Pick a valid date and time.");
      return;
    }
    const formData = new FormData();
    formData.set("startsAt", iso);
    startTransition(async () => {
      try {
        await addPollOption(campaignId, pollId, formData);
        setValue("");
        toast.success(isDM ? "Date added." : "Date added, and you're marked as a Yes.");
      } catch (err) {
        toast.error(errorMessage(err));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md bg-muted/50 p-4">
      <Label htmlFor="poll-new-date" className="font-medium">
        {isDM ? "Add another date" : "None of these work?"}
      </Label>
      <p className="text-xs text-muted-foreground">
        {isDM
          ? "Players who have already voted are told about it."
          : "Suggest a date you can make. You'll be marked as a Yes, and the others will be asked about it."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="poll-new-date"
          type="datetime-local"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="sm:max-w-64"
        />
        <Button type="submit" variant="outline" disabled={isPending || !value} className="shrink-0">
          <CalendarPlusIcon /> {isDM ? "Add date" : "Suggest date"}
        </Button>
      </div>
    </form>
  );
}
