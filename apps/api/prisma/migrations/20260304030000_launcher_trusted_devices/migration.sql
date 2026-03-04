-- CreateTable
CREATE TABLE "LauncherTrustedDevice" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "publicKeyHash" TEXT NOT NULL,
    "publicKeyBase64" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "trustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LauncherTrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LauncherTrustedDevice_installationId_key" ON "LauncherTrustedDevice"("installationId");

-- CreateIndex
CREATE INDEX "LauncherTrustedDevice_revokedAt_idx" ON "LauncherTrustedDevice"("revokedAt");

-- CreateIndex
CREATE INDEX "LauncherTrustedDevice_publicKeyHash_idx" ON "LauncherTrustedDevice"("publicKeyHash");
