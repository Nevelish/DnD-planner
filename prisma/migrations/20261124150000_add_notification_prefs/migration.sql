-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mutedMentionTypes" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[],
ADD COLUMN     "mutedNotificationTypes" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[];
