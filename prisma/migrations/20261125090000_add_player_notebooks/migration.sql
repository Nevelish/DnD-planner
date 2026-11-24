-- AlterTable
-- ownerId NULL = the campaign DM's notebook (every existing row);
-- a user id = that player's private notebook.
ALTER TABLE "DmPage" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "DmPage_campaignId_ownerId_idx" ON "DmPage"("campaignId", "ownerId");

-- AddForeignKey
ALTER TABLE "DmPage" ADD CONSTRAINT "DmPage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each player's single private note becomes a pinned "My notes" page in
-- their new notebook. The old PlayerNote rows are left untouched (nothing
-- reads them any more), so nothing is lost if this ever needs undoing.
INSERT INTO "DmPage" ("id", "campaignId", "ownerId", "title", "content", "pinned", "createdAt", "updatedAt")
SELECT 'nbp' || replace(gen_random_uuid()::text, '-', ''), "campaignId", "userId", 'My notes', "content", true, "createdAt", "updatedAt"
FROM "PlayerNote"
WHERE btrim("content") <> '';
