-- AlterTable: add isArchived to tasks
ALTER TABLE "tasks" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add isArchived to documents
ALTER TABLE "documents" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
