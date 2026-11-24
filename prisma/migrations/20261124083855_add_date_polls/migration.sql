-- CreateEnum
CREATE TYPE "DatePollStatus" AS ENUM ('OPEN', 'DECIDED', 'CANCELLED');

-- AlterEnum
-- The webhook default/backfill that use this value live in the next
-- migration: Postgres won't use a new enum value before it's committed.
ALTER TYPE "NotificationType" ADD VALUE 'DATE_POLL_OPENED';

-- CreateTable
CREATE TABLE "DatePoll" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "status" "DatePollStatus" NOT NULL DEFAULT 'OPEN',
    "sessionProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatePoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatePollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatePollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatePollVote" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "choice" "RsvpStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatePollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DatePoll_sessionProposalId_key" ON "DatePoll"("sessionProposalId");

-- CreateIndex
CREATE INDEX "DatePoll_campaignId_status_idx" ON "DatePoll"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DatePollOption_pollId_startsAt_key" ON "DatePollOption"("pollId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DatePollVote_optionId_memberId_key" ON "DatePollVote"("optionId", "memberId");

-- AddForeignKey
ALTER TABLE "DatePoll" ADD CONSTRAINT "DatePoll_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePoll" ADD CONSTRAINT "DatePoll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePoll" ADD CONSTRAINT "DatePoll_sessionProposalId_fkey" FOREIGN KEY ("sessionProposalId") REFERENCES "SessionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePollOption" ADD CONSTRAINT "DatePollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "DatePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePollVote" ADD CONSTRAINT "DatePollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "DatePollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePollVote" ADD CONSTRAINT "DatePollVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CampaignMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
