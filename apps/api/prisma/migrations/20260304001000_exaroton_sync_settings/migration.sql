-- AlterTable
ALTER TABLE "ExarotonIntegration"
ADD COLUMN     "modsSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "playerCanViewStatus" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "playerCanModifyStatus" BOOLEAN NOT NULL DEFAULT false;
