-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "status" "DocStatus" NOT NULL DEFAULT 'DRAFT';
