"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import { deleteCharacter } from "@/lib/actions/character";
import { Button } from "@/components/ui/button";

export function DeleteCharacterButton({
  campaignId,
  characterId,
}: {
  campaignId: string;
  characterId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await deleteCharacter(campaignId, characterId);
            toast.success("Character removed.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Something went wrong.");
          }
        })
      }
    >
      <Trash2Icon className="text-destructive" />
    </Button>
  );
}
