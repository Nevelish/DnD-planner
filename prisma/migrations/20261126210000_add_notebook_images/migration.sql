-- CreateTable
CREATE TABLE "NotebookImage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kind" "NotebookKind" NOT NULL,
    "ownerId" TEXT,
    "uploadedById" TEXT,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookImage_campaignId_kind_ownerId_idx" ON "NotebookImage"("campaignId", "kind", "ownerId");

-- AddForeignKey
ALTER TABLE "NotebookImage" ADD CONSTRAINT "NotebookImage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookImage" ADD CONSTRAINT "NotebookImage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookImage" ADD CONSTRAINT "NotebookImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

