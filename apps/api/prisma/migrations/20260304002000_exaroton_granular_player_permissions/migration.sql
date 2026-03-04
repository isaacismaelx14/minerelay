-- AlterTable
ALTER TABLE "ExarotonIntegration"
ADD COLUMN     "playerCanStartServer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playerCanStopServer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playerCanRestartServer" BOOLEAN NOT NULL DEFAULT false;
