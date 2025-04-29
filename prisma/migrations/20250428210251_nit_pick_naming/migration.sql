/*
  Warnings:

  - You are about to drop the column `media_link` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "media_link",
ADD COLUMN     "media_links" TEXT[];
