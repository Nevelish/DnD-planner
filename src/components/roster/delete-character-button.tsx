"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import { deleteCharacter } from "@/lib/actions/character";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/userError";

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
            toast.error(errorMessage(e));
          }
        })
      }
    >
      <Trash2Icon className="text-destructive" />
    </Button>
  );
}
