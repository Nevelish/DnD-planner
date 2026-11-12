import { ExternalLinkIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharacterForm } from "@/components/roster/character-form";
import { DeleteCharacterButton } from "@/components/roster/delete-character-button";
import { DndBeyondLinkField } from "@/components/roster/dndbeyond-link-field";
import type { Character } from "@prisma/client";

export function CharacterCard({
  campaignId,
  character,
  ownerName,
  isOwn,
}: {
  campaignId: string;
  character: Character;
  ownerName: string;
  isOwn: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{character.name}</CardTitle>
            <CardDescription>
              Level {character.level} {character.race ? `${character.race} ` : ""}
              {character.class} · played by {ownerName}
            </CardDescription>
          </div>
          {isOwn && (
            <div className="flex items-center gap-1">
              <CharacterForm
                campaignId={campaignId}
                characterId={character.id}
                defaultValues={character}
                trigger={
                  <button className="text-sm font-medium underline underline-offset-2">
                    Edit
                  </button>
                }
              />
              <DeleteCharacterButton campaignId={campaignId} characterId={character.id} />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-6">
        {character.notes && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {character.notes}
          </p>
        )}
        {character.dndBeyondUrl && (
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <a href={character.dndBeyondUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon /> Open on D&amp;D Beyond
            </a>
          </Button>
        )}
        {isOwn ? (
          <DndBeyondLinkField
            campaignId={campaignId}
            characterId={character.id}
            dndBeyondUrl={character.dndBeyondUrl}
            syncStatus={character.dndBeyondSyncStatus}
          />
        ) : (
          character.dndBeyondSyncStatus === "SUCCESS" && (
            <Badge variant="success" className="w-fit">
              Synced from D&amp;D Beyond
            </Badge>
          )
        )}
      </CardContent>
    </Card>
  );
}
