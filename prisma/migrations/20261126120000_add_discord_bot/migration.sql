-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "discordAutoJoin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discordChannelId" TEXT;

-- CreateTable
CREATE TABLE "DiscordSessionMessage" (
    "id" TEXT NOT NULL,
    "sessionProposalId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "embed" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordSessionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscordSessionMessage_sessionProposalId_idx" ON "DiscordSessionMessage"("sessionProposalId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordSessionMessage_channelId_messageId_key" ON "DiscordSessionMessage"("channelId", "messageId");

-- AddForeignKey
ALTER TABLE "DiscordSessionMessage" ADD CONSTRAINT "DiscordSessionMessage_sessionProposalId_fkey" FOREIGN KEY ("sessionProposalId") REFERENCES "SessionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

