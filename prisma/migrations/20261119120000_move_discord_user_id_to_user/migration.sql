-- AlterTable
ALTER TABLE "User" ADD COLUMN     "discordUserId" TEXT;

-- Backfill: carry over each account's existing per-character Discord user ID
-- (best effort — if a user somehow set different IDs on multiple characters,
-- the oldest one wins).
UPDATE "User" u
SET "discordUserId" = sub."discordUserId"
FROM (
  SELECT DISTINCT ON (cm."userId") cm."userId", c."discordUserId"
  FROM "Character" c
  JOIN "CampaignMember" cm ON cm.id = c."memberId"
  WHERE c."discordUserId" IS NOT NULL
  ORDER BY cm."userId", c."createdAt" ASC
) sub
WHERE u.id = sub."userId";

-- AlterTable
ALTER TABLE "Character" DROP COLUMN "discordUserId";
