"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { updatePublicUrlAction, type ActionResult } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionResult = {};

export function PublicUrlForm({ currentUrl }: { currentUrl: string }) {
  const [state, formAction, isPending] = useActionState(
    updatePublicUrlAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Public URL updated.");
    }
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="publicUrl">Public URL</Label>
        <Input
          id="publicUrl"
          name="publicUrl"
          type="url"
          placeholder="https://dnd.nevelish.tv"
          defaultValue={currentUrl}
          className="font-mono text-xs"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
