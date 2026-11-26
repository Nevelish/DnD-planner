-- CreateTable
CREATE TABLE "CampaignRemoval" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "discordId" TEXT,
    "name" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignRemoval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignRemoval_campaignId_discordId_idx" ON "CampaignRemoval"("campaignId", "discordId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRemoval_campaignId_userId_key" ON "CampaignRemoval"("campaignId", "userId");

-- AddForeignKey
ALTER TABLE "CampaignRemoval" ADD CONSTRAINT "CampaignRemoval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRemoval" ADD CONSTRAINT "CampaignRemoval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

