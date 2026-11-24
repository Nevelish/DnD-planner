-- AlterTable
ALTER TABLE "DatePollOption" ADD COLUMN     "addedById" TEXT;

-- AddForeignKey
ALTER TABLE "DatePollOption" ADD CONSTRAINT "DatePollOption_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

