"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateCampaign } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function EditCampaignForm({
  campaignId,
  name,
  description,
}: {
  campaignId: string;
  name: string;
  description: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateCampaign(campaignId, formData);
        toast.success("Campaign updated.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={description ?? ""}
        />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        Save changes
      </Button>
    </form>
  );
}
