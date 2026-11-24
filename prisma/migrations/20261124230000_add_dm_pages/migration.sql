-- CreateTable
CREATE TABLE "DmPage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sessionProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DmPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DmPage_sessionProposalId_key" ON "DmPage"("sessionProposalId");

-- CreateIndex
CREATE INDEX "DmPage_campaignId_updatedAt_idx" ON "DmPage"("campaignId", "updatedAt");

-- AddForeignKey
ALTER TABLE "DmPage" ADD CONSTRAINT "DmPage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DmPage" ADD CONSTRAINT "DmPage_sessionProposalId_fkey" FOREIGN KEY ("sessionProposalId") REFERENCES "SessionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Move the DM's existing notes into the notebook. The old CampaignNote rows
-- are left as they were (nothing reads them any more), so nothing is lost
-- if this ever needs undoing.

-- "Campaign notes" becomes a pinned page.
INSERT INTO "DmPage" ("id", "campaignId", "title", "content", "pinned", "createdAt", "updatedAt")
SELECT 'dmp' || replace(gen_random_uuid()::text, '-', ''), "campaignId", 'Campaign notes', "content", true, "createdAt", "updatedAt"
FROM "CampaignNote"
WHERE "type" = 'GENERAL' AND btrim("content") <> '';

-- "Next session prep" becomes the prep of each campaign's next upcoming
-- session, or a plain page if there isn't one.
WITH next_session AS (
    SELECT DISTINCT ON ("campaignId") "id", "campaignId"
    FROM "SessionProposal"
    WHERE "status" IN ('DRAFT', 'PROPOSED', 'CONFIRMED') AND "startsAt" >= now()
    ORDER BY "campaignId", "startsAt"
)
INSERT INTO "DmPage" ("id", "campaignId", "title", "content", "sessionProposalId", "createdAt", "updatedAt")
SELECT 'dmp' || replace(gen_random_uuid()::text, '-', ''), n."campaignId",
       CASE WHEN s."id" IS NULL THEN 'Next session prep' ELSE 'Session prep' END,
       n."content", s."id", n."createdAt", n."updatedAt"
FROM "CampaignNote" n
LEFT JOIN next_session s ON s."campaignId" = n."campaignId"
WHERE n."type" = 'NEXT_SESSION_PREP' AND btrim(n."content") <> '';
