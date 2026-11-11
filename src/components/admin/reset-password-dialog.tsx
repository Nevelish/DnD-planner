"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adminResetPassword } from "@/lib/actions/admin";
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
} from "@/components/ui/dialog";

type TargetUser = { id: string; name: string | null; email: string | null };

export function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: TargetUser | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleReset() {
    if (!user) return;
    startTransition(async () => {
      try {
        await adminResetPassword(user.id, password);
        toast.success(`Password updated for ${user.name ?? user.email}.`);
        setPassword("");
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) setPassword("");
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {user?.name ?? user?.email}. Share it with
            them yourself — there&apos;s no email sent.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-new-password">New password</Label>
          <Input
            id="admin-new-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoFocus
            className="font-mono text-xs"
          />
        </div>
        <DialogFooter>
          <Button disabled={password.length < 8 || isPending} onClick={handleReset}>
            {isPending ? "Saving…" : "Set password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
