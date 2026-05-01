-- AlterTable: add coverIdx and docEmoji to documents
ALTER TABLE "documents" ADD COLUMN "coverIdx" INTEGER;
ALTER TABLE "documents" ADD COLUMN "docEmoji" TEXT;
