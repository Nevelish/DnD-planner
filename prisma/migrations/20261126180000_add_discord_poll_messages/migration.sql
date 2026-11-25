-- CreateTable
CREATE TABLE "DiscordPollMessage" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "embed" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordPollMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscordPollMessage_pollId_idx" ON "DiscordPollMessage"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordPollMessage_channelId_messageId_key" ON "DiscordPollMessage"("channelId", "messageId");

-- AddForeignKey
ALTER TABLE "DiscordPollMessage" ADD CONSTRAINT "DiscordPollMessage_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "DatePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

