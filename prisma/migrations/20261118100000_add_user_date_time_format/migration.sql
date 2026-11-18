-- CreateEnum
CREATE TYPE "TimeFormat" AS ENUM ('HOUR_12', 'HOUR_24');

-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('DMY', 'MDY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timeFormat" "TimeFormat" NOT NULL DEFAULT 'HOUR_24',
ADD COLUMN     "dateFormat" "DateFormat" NOT NULL DEFAULT 'DMY';
