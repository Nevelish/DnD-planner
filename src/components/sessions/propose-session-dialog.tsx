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

function toLocalInputValue(date?: Date | null) {
  if (!date) return "";
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
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
  defaultValues?: {
    title?: string | null;
    startsAt?: Date | null;
    durationMinutes?: number | null;
  };
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
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              name="title"
              defaultValue={defaultValues?.title ?? ""}
              placeholder="Session 12: The Dragon's Lair"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startsAt">Date &amp; time</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toLocalInputValue(defaultValues?.startsAt)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="durationMinutes">Duration in minutes (optional)</Label>
            <Input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={15}
              step={15}
              defaultValue={defaultValues?.durationMinutes ?? ""}
              placeholder="180"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
