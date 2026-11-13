"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { createCharacter, updateCharacter } from "@/lib/actions/character";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export function CharacterForm({
  campaignId,
  characterId,
  defaultValues,
  trigger,
}: {
  campaignId: string;
  characterId?: string;
  defaultValues?: {
    name: string;
    class: string;
    level: number;
    race: string | null;
    notes: string | null;
    discordUserId: string | null;
  };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!characterId;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateCharacter(campaignId, characterId, formData);
        } else {
          await createCharacter(campaignId, formData);
        }
        toast.success("Character saved.");
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
            <PlusIcon /> Add my character
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit character" : "Add your character"}</DialogTitle>
          <DialogDescription>
            Visible to the DM and the rest of the party.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={defaultValues?.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="level">Level</Label>
              <Input
                id="level"
                name="level"
                type="number"
                min={1}
                max={20}
                defaultValue={defaultValues?.level ?? 1}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="class">Class</Label>
              <Input
                id="class"
                name="class"
                defaultValue={defaultValues?.class}
                placeholder="Rogue"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race">Race (optional)</Label>
              <Input id="race" name="race" defaultValue={defaultValues?.race ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" defaultValue={defaultValues?.notes ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discordUserId">Discord user ID (optional)</Label>
            <Input
              id="discordUserId"
              name="discordUserId"
              inputMode="numeric"
              placeholder="e.g. 1234567890123456"
              defaultValue={defaultValues?.discordUserId ?? ""}
            />
            <p className="text-sm text-muted-foreground">
              If set, you&apos;ll be @mentioned in Discord when a session is proposed or
              cancelled. Find yours in Discord under Settings → Advanced → Enable Developer
              Mode, then right-click your name and Copy User ID.
            </p>
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
