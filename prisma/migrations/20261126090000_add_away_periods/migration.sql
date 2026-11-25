-- CreateTable
CREATE TABLE "AwayPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AwayPeriod_userId_endsOn_idx" ON "AwayPeriod"("userId", "endsOn");

-- AddForeignKey
ALTER TABLE "AwayPeriod" ADD CONSTRAINT "AwayPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

