-- AlterTable
ALTER TABLE "Campaign" ALTER COLUMN "discordWebhookEvents" SET DEFAULT ARRAY['SESSION_PROPOSED', 'SESSION_RESCHEDULED', 'SESSION_CONFIRMED', 'SESSION_CANCELLED', 'SESSION_REMINDER', 'DATE_POLL_OPENED', 'RECAP_POSTED', 'RSVP_CHANGED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'RECURRING_DRAFT_READY', 'PAGE_REVEALED']::"NotificationType"[];

-- AlterTable
ALTER TABLE "DmPage" ADD COLUMN     "revealedAt" TIMESTAMP(3),
ADD COLUMN     "revealedFromId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DmPage_revealedFromId_key" ON "DmPage"("revealedFromId");

-- AddForeignKey
ALTER TABLE "DmPage" ADD CONSTRAINT "DmPage_revealedFromId_fkey" FOREIGN KEY ("revealedFromId") REFERENCES "DmPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing campaigns post reveals to Discord too, like new ones.
UPDATE "Campaign"
SET "discordWebhookEvents" = array_append("discordWebhookEvents", 'PAGE_REVEALED')
WHERE NOT ('PAGE_REVEALED' = ANY("discordWebhookEvents"));
