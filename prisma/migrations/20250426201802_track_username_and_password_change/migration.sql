-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password_changed_at" TIMESTAMP(3),
ADD COLUMN     "username_changed_at" TIMESTAMP(3);
