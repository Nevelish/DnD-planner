"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlusIcon, MapPinIcon, MonitorIcon } from "lucide-react";
import type { SessionFormat } from "@prisma/client";

import { createProposal, updateProposal, publishDraft } from "@/lib/actions/session";
import {
  addMinutesToLocalValue,
  localInputToISO,
  toLocalInputValue,
} from "@/lib/localDateTimeInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/userError";
import { AwayWarning } from "@/components/sessions/away-warning";
import type { AwayRange } from "@/lib/awayDays";

type Mode = "create" | "edit" | "publish";
type ProposalDefaults = {
  title?: string | null;
  startsAt?: Date | null;
  durationMinutes?: number | null;
  format?: SessionFormat | null;
  location?: string | null;
  description?: string | null;
};

const FORMAT_OPTIONS = [
  { value: "IN_PERSON", label: "In person", icon: MapPinIcon },
  { value: "ONLINE", label: "Online", icon: MonitorIcon },
] as const;

const LOCATION_FIELD = {
  IN_PERSON: { label: "Address or place", placeholder: "Sam's place, Storgata 12" },
  ONLINE: { label: "Link or platform", placeholder: "https://discord.gg/… or Roll20" },
  UNSET: { label: "Location", placeholder: "A place, or a link for online games" },
} as const;

const DEFAULT_DURATION_MINUTES = 180;

/**
 * Radix only mounts a Dialog's content while it's open, so this remounting
 * on every open is what gives each field its fresh initial state from
 * `defaultValues` — no effect-based reset needed.
 */
function ProposalFormFields({
  defaultValues,
  away,
  onSubmit,
  isPending,
}: {
  defaultValues?: ProposalDefaults;
  away: AwayRange[];
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
  // Until the DM edits the end time by hand, it follows the start so the
  // session keeps its length (e.g. moving an existing session a day later
  // moves its end too, instead of leaving it on the old date).
  const [endTouched, setEndTouched] = useState(false);
  const length = defaultValues?.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const [format, setFormat] = useState<SessionFormat | null>(defaultValues?.format ?? null);
  const locationField = LOCATION_FIELD[format ?? "UNSET"];

  function handleStartChange(value: string) {
    setStartsAt(value);
    if (!endTouched) {
      setEndsAt(value ? addMinutesToLocalValue(value, length) : "");
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
      <AwayWarning away={away} value={startsAt} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Where are you playing?</legend>
        {/* Toggle buttons rather than radios so the DM can unset it again;
            tapping the active option clears it. */}
        <input type="hidden" name="format" value={format ?? ""} />
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant="outline"
              aria-pressed={format === value}
              onClick={() => setFormat(format === value ? null : value)}
              className={cn(
                format === value &&
                  "border-primary bg-primary/10 text-foreground hover:bg-primary/15",
              )}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">{locationField.label} (optional)</Label>
        <Input
          id="location"
          name="location"
          maxLength={200}
          defaultValue={defaultValues?.location ?? ""}
          placeholder={locationField.placeholder}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Notes for players (optional)</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Bring snacks — we're finishing the heist."
        />
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
  away = [],
  trigger,
}: {
  campaignId: string;
  proposalId?: string;
  mode?: Mode;
  defaultValues?: ProposalDefaults;
  /** Players' away dates, to warn about a clash with the chosen day. */
  away?: AwayRange[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    for (const key of ["startsAt", "endsAt"]) {
      const value = formData.get(key);
      const iso = typeof value === "string" ? localInputToISO(value) : null;
      if (iso) formData.set(key, iso);
    }

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
        toast.error(errorMessage(e));
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
            away={away}
            onSubmit={handleSubmit}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
