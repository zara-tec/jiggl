-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "kind" TEXT,
ADD COLUMN     "to" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "memberIds" JSONB;

