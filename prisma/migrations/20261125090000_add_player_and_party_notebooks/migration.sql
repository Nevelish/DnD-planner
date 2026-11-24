-- CreateEnum
-- (A brand-new enum type can be used in the same migration; only values
-- added to an existing enum can't.)
CREATE TYPE "NotebookKind" AS ENUM ('DM', 'PERSONAL', 'PARTY');

-- AlterTable
-- Every existing page is in a DM notebook, which is the default.
ALTER TABLE "DmPage" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "kind" "NotebookKind" NOT NULL DEFAULT 'DM',
ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "DmPage_campaignId_kind_ownerId_idx" ON "DmPage"("campaignId", "kind", "ownerId");

-- AddForeignKey
ALTER TABLE "DmPage" ADD CONSTRAINT "DmPage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmPage" ADD CONSTRAINT "DmPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move the old single-page notes into the new notebooks. The old rows are
-- left untouched (nothing reads them any more), so nothing is lost if this
-- ever needs undoing. Blank notes are skipped.

-- Each player's private note → a pinned "My notes" page in their notebook.
INSERT INTO "DmPage" ("id", "campaignId", "kind", "ownerId", "createdById", "title", "content", "pinned", "createdAt", "updatedAt")
SELECT 'nbp' || replace(gen_random_uuid()::text, '-', ''), "campaignId", 'PERSONAL', "userId", "userId", 'My notes', "content", true, "createdAt", "updatedAt"
FROM "PlayerNote"
WHERE btrim("content") <> '';

-- The shared party note → a pinned "Party notes" page in the party notebook.
INSERT INTO "DmPage" ("id", "campaignId", "kind", "createdById", "title", "content", "pinned", "createdAt", "updatedAt")
SELECT 'nbp' || replace(gen_random_uuid()::text, '-', ''), "campaignId", 'PARTY', "authorId", 'Party notes', "content", true, "createdAt", "updatedAt"
FROM "CampaignNote"
WHERE "type" = 'PARTY' AND btrim("content") <> '';
