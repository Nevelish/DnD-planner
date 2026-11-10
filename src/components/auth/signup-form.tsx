"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { signUpAction, type ActionResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionResult = {};

export function SignUpForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.push(callbackUrl);
      router.refresh();
    }
  }, [state.success, router, callbackUrl]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
