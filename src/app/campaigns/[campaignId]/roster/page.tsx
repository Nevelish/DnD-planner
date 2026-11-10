import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { CharacterCard } from "@/components/roster/character-card";
import { CharacterForm } from "@/components/roster/character-form";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { membership } = await requireMembershipForPage(campaignId);

  const characters = await prisma.character.findMany({
    where: { campaignId },
    include: { member: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const ownCharacter = characters.find((c) => c.memberId === membership.id);
  const canAddCharacter = membership.role === "PLAYER" && !ownCharacter;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Party roster</h2>
        {canAddCharacter && <CharacterForm campaignId={campaignId} />}
      </div>

      {characters.length === 0 ? (
        <p className="text-muted-foreground">No characters yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {characters.map((character) => (
            <CharacterCard
              key={character.id}
              campaignId={campaignId}
              character={character}
              ownerName={character.member.user.name ?? character.member.user.email ?? "Unknown"}
              isOwn={character.memberId === membership.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
