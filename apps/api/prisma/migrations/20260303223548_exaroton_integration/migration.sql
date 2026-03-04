-- CreateTable
CREATE TABLE "ExarotonIntegration" (
    "id" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "accountName" TEXT,
    "accountEmail" TEXT,
    "selectedServerId" TEXT,
    "selectedServerName" TEXT,
    "selectedServerAddress" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExarotonIntegration_pkey" PRIMARY KEY ("id")
);
