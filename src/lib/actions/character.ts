"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/permissions";
import { characterSchema } from "@/lib/validations/character";
import { parseCharacterId, fetchDndBeyondCharacter } from "@/lib/dndbeyond";

function parseCharacterForm(formData: FormData) {
  const parsed = characterSchema.safeParse({
    name: formData.get("name"),
    class: formData.get("class"),
    level: formData.get("level"),
    race: formData.get("race"),
    notes: formData.get("notes"),
    discordUserId: formData.get("discordUserId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  return parsed.data;
}

async function requireOwnCharacter(campaignId: string, characterId: string) {
  const membership = await requireMember(campaignId);
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character || character.memberId !== membership.id) {
    throw new Error("You can only manage your own character.");
  }
  return { membership, character };
}

export async function createCharacter(campaignId: string, formData: FormData) {
  const membership = await requireMember(campaignId);
  const data = parseCharacterForm(formData);

  await prisma.character.create({
    data: { campaignId, memberId: membership.id, ...data },
  });

  revalidatePath(`/campaigns/${campaignId}/roster`);
}

export async function updateCharacter(
  campaignId: string,
  characterId: string,
  formData: FormData,
) {
  await requireOwnCharacter(campaignId, characterId);
  const data = parseCharacterForm(formData);

  await prisma.character.update({ where: { id: characterId }, data });
  revalidatePath(`/campaigns/${campaignId}/roster`);
}

export async function deleteCharacter(campaignId: string, characterId: string) {
  await requireOwnCharacter(campaignId, characterId);
  await prisma.character.delete({ where: { id: characterId } });
  revalidatePath(`/campaigns/${campaignId}/roster`);
}

export async function linkDndBeyond(
  campaignId: string,
  characterId: string,
  url: string,
) {
  const { character } = await requireOwnCharacter(campaignId, characterId);

  const dndBeyondCharacterId = parseCharacterId(url);
  if (!dndBeyondCharacterId) {
    throw new Error("That doesn't look like a D&D Beyond character URL.");
  }

  await prisma.character.update({
    where: { id: characterId },
    data: { dndBeyondUrl: url, dndBeyondCharacterId, dndBeyondSyncStatus: "PENDING" },
  });

  const result = await fetchDndBeyondCharacter(dndBeyondCharacterId);

  if (result.status === "SUCCESS") {
    await prisma.character.update({
      where: { id: characterId },
      data: {
        dndBeyondSyncStatus: "SUCCESS",
        dndBeyondLastSyncedAt: new Date(),
        dndBeyondSnapshot: result.snapshot as Prisma.InputJsonValue,
        name: result.name ?? character.name,
        race: result.race ?? character.race,
        level: result.level ?? character.level,
        class: result.className ?? character.class,
      },
    });
  } else {
    await prisma.character.update({
      where: { id: characterId },
      data: { dndBeyondSyncStatus: result.status },
    });
    throw new Error(
      result.status === "PRIVATE"
        ? "That character sheet is private. Make it public on D&D Beyond, or keep editing it manually here."
        : "Couldn't reach D&D Beyond right now. Your manual details are unchanged.",
    );
  }

  revalidatePath(`/campaigns/${campaignId}/roster`);
}

export async function unlinkDndBeyond(campaignId: string, characterId: string) {
  await requireOwnCharacter(campaignId, characterId);

  await prisma.character.update({
    where: { id: characterId },
    data: {
      dndBeyondUrl: null,
      dndBeyondCharacterId: null,
      dndBeyondSyncStatus: "NOT_LINKED",
      dndBeyondSnapshot: Prisma.JsonNull,
      dndBeyondLastSyncedAt: null,
    },
  });

  revalidatePath(`/campaigns/${campaignId}/roster`);
}
