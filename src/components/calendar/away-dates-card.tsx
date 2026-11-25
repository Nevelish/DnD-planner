"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlaneIcon, XIcon } from "lucide-react";

import { addAwayPeriod, removeAwayPeriod } from "@/lib/actions/away";
import { errorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type MyAwayPeriod = { id: string; label: string; note: string | null };

export function AwayDatesCard({ periods, today }: { periods: MyAwayPeriod[]; today: string }) {
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleStartChange(value: string) {
    setStartsOn(value);
    // Most away dates are a few days; start the last day off on the first.
    if (!endsOn || endsOn < value) setEndsOn(value);
  }

  function handleAdd() {
    const formData = new FormData();
    formData.set("startsOn", startsOn);
    formData.set("endsOn", endsOn);
    formData.set("note", note);
    startTransition(async () => {
      try {
        await addAwayPeriod(formData);
        toast.success("Away dates added. The DM will see them when picking dates.");
        setStartsOn("");
        setEndsOn("");
        setNote("");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  function handleRemove(period: MyAwayPeriod) {
    startTransition(async () => {
      try {
        await removeAwayPeriod(period.id);
        toast.success("Away dates removed.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Away dates</CardTitle>
        <CardDescription>
          Days you can&apos;t play, like a holiday. Everyone in your campaigns
          sees them, and the DM gets a heads-up when picking a date that clashes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-6">
        {periods.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-lg border" aria-label="Your away dates">
            {periods.map((period) => (
              <li key={period.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <PlaneIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{period.label}</span>
                  {period.note && <span className="truncate text-muted-foreground">· {period.note}</span>}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove away dates ${period.label}`}
                  disabled={isPending}
                  onClick={() => handleRemove(period)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">You haven&apos;t added any away dates.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="away-from">First day</Label>
            <Input
              id="away-from"
              type="date"
              min={today}
              value={startsOn}
              onChange={(e) => handleStartChange(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="away-to">Last day</Label>
            <Input
              id="away-to"
              type="date"
              min={startsOn || today}
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="away-note">Note (optional)</Label>
            <Input
              id="away-note"
              maxLength={100}
              placeholder="Holiday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button type="button" disabled={isPending || !startsOn || !endsOn} onClick={handleAdd}>
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
