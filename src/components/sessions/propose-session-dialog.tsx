"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlusIcon } from "lucide-react";

import { createProposal, updateProposal, publishDraft } from "@/lib/actions/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Mode = "create" | "edit" | "publish";
type ProposalDefaults = {
  title?: string | null;
  startsAt?: Date | null;
  durationMinutes?: number | null;
};

const DEFAULT_DURATION_MINUTES = 180;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Formats a Date as the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInputValue(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Adds minutes to a "YYYY-MM-DDTHH:mm" string, staying in the same local wall-clock time. */
function addMinutesToLocalValue(value: string, minutes: number) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInputValue(d);
}

/**
 * Radix only mounts a Dialog's content while it's open, so this remounting
 * on every open is what gives each field its fresh initial state from
 * `defaultValues` — no effect-based reset needed.
 */
function ProposalFormFields({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: ProposalDefaults;
  onSubmit: (formData: FormData) => void;
  isPending: boolean;
}) {
  const initialStart = toLocalInputValue(defaultValues?.startsAt);
  const initialEnd =
    initialStart && defaultValues?.durationMinutes
      ? addMinutesToLocalValue(initialStart, defaultValues.durationMinutes)
      : "";

  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(initialEnd);
  const [endTouched, setEndTouched] = useState(!!initialEnd);

  function handleStartChange(value: string) {
    setStartsAt(value);
    if (!endTouched) {
      setEndsAt(value ? addMinutesToLocalValue(value, DEFAULT_DURATION_MINUTES) : "");
    }
  }

  function handleEndChange(value: string) {
    setEndsAt(value);
    setEndTouched(true);
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title (optional)</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultValues?.title ?? ""}
          placeholder="Session 12: The Dragon's Lair"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startsAt">Starts</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => handleStartChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endsAt">Ends</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            min={startsAt || undefined}
            value={endsAt}
            onChange={(e) => handleEndChange(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProposeSessionDialog({
  campaignId,
  proposalId,
  mode = "create",
  defaultValues,
  trigger,
}: {
  campaignId: string;
  proposalId?: string;
  mode?: Mode;
  defaultValues?: ProposalDefaults;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createProposal(campaignId, formData);
        } else if (mode === "edit" && proposalId) {
          await updateProposal(campaignId, proposalId, formData);
        } else if (mode === "publish" && proposalId) {
          await publishDraft(campaignId, proposalId, formData);
        }
        toast.success("Session saved.");
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <CalendarPlusIcon /> Propose a session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Propose the next session" : "Edit session"}
          </DialogTitle>
          <DialogDescription>
            Players will be able to RSVP once this is saved.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProposalFormFields
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
