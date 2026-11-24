"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarSearchIcon, PlusIcon, XIcon } from "lucide-react";

import { createPoll } from "@/lib/actions/poll";
import { MAX_POLL_OPTIONS } from "@/lib/validations/poll";
import {
  addMinutesToLocalValue,
  localInputToISO,
} from "@/lib/localDateTimeInput";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const LENGTH_OPTIONS = [2, 3, 4, 5, 6].map((h) => ({ minutes: h * 60, label: `${h} hours` }));

function PollFormFields({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("180");
  const [dates, setDates] = useState(["", "", ""]);

  function setDate(index: number, value: string) {
    setDates((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function addDate() {
    // Most polls are "same time, different day" — start the new row a day
    // after the last one the DM filled in.
    const last = [...dates].reverse().find(Boolean) ?? "";
    setDates((prev) => [...prev, last ? addMinutesToLocalValue(last, 24 * 60) : ""]);
  }

  function removeDate(index: number) {
    setDates((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const formData = new FormData();
    formData.set("title", title);
    formData.set("durationMinutes", durationMinutes);
    for (const value of dates) {
      const iso = localInputToISO(value);
      if (iso) formData.append("options", iso);
    }

    startTransition(async () => {
      try {
        const { pollId } = await createPoll(campaignId, formData);
        toast.success("Poll sent to the party.");
        onDone();
        router.push(`/campaigns/${campaignId}/polls/${pollId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="poll-title">Session title (optional)</Label>
        <Input
          id="poll-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Session 12: The Dragon's Lair"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="poll-length">Session length</Label>
        <Select value={durationMinutes} onValueChange={setDurationMinutes}>
          <SelectTrigger id="poll-length" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LENGTH_OPTIONS.map((o) => (
              <SelectItem key={o.minutes} value={String(o.minutes)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Dates to choose from</legend>
        {dates.map((value, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type="datetime-local"
              aria-label={`Date option ${index + 1}`}
              value={value}
              onChange={(e) => setDate(index, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove date option ${index + 1}`}
              disabled={dates.length <= 2}
              onClick={() => removeDate(index)}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        {dates.length < MAX_POLL_OPTIONS && (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addDate}>
            <PlusIcon /> Add another date
          </Button>
        )}
      </fieldset>
      <DialogFooter>
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Sending…" : "Send poll"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function CreatePollDialog({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarSearchIcon /> Find a date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find a date that works</DialogTitle>
          <DialogDescription>
            Offer a few dates you could run it. Players mark which ones work
            for them, then you pick the winner.
          </DialogDescription>
        </DialogHeader>
        {open && <PollFormFields campaignId={campaignId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
