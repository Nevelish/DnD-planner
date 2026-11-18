"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteUser } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TargetUser = { id: string; name: string | null; email: string | null };

export function DeleteUserDialog({
  user,
  onOpenChange,
}: {
  user: TargetUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!user) return;
    startTransition(async () => {
      try {
        await deleteUser(user.id);
        toast.success(`${user.name ?? user.email} was deleted.`);
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this account?</DialogTitle>
          <DialogDescription>
            This permanently deletes {user?.name ?? user?.email}&apos;s account,
            campaign memberships, characters, and private notes. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
