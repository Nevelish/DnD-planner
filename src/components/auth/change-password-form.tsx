"use client";

import { useActionState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { changePasswordAction, type ActionResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionResult = {};

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState,
  );

  // A successful change redirects back here with ?password=changed (see
  // changePasswordAction); say so once, then tidy the URL.
  const router = useRouter();
  const pathname = usePathname();
  const changed = useSearchParams().get("password") === "changed";
  useEffect(() => {
    if (!changed) return;
    // A fixed id, so it shows once even if this effect runs twice.
    toast.success("Password updated. Any other devices signed in to your account have been signed out.", {
      id: "password-changed",
    });
    router.replace(pathname);
  }, [changed, pathname, router]);

  return (
    <form
      action={formAction}
      key={changed ? "reset" : "form"}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
