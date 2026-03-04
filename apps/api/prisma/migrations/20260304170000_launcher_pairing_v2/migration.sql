-- AlterTable
ALTER TABLE "LauncherTrustedDevice"
ADD COLUMN "deviceFingerprintHash" TEXT,
ADD COLUMN "appVersion" TEXT,
ADD COLUMN "platform" TEXT;

-- Backfill with a deterministic placeholder so the column can become required.
UPDATE "LauncherTrustedDevice"
SET "deviceFingerprintHash" = 'legacy:' || "installationId"
WHERE "deviceFingerprintHash" IS NULL;

ALTER TABLE "LauncherTrustedDevice"
ALTER COLUMN "deviceFingerprintHash" SET NOT NULL;

-- CreateTable
CREATE TABLE "LauncherPairingClaim" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" TEXT,
    "consumedByInstallationId" TEXT,
    "consumedByDeviceHash" TEXT,

    CONSTRAINT "LauncherPairingClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LauncherChallenge" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "LauncherChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LauncherSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "publicKeyBase64" TEXT NOT NULL,
    "userAgentHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LauncherSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LauncherSessionNonce" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LauncherSessionNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LauncherTrustedDevice_deviceFingerprintHash_idx" ON "LauncherTrustedDevice"("deviceFingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "LauncherPairingClaim_tokenHash_key" ON "LauncherPairingClaim"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "LauncherPairingClaim_codeHash_key" ON "LauncherPairingClaim"("codeHash");

-- CreateIndex
CREATE INDEX "LauncherPairingClaim_expiresAt_idx" ON "LauncherPairingClaim"("expiresAt");

-- CreateIndex
CREATE INDEX "LauncherPairingClaim_revokedAt_idx" ON "LauncherPairingClaim"("revokedAt");

-- CreateIndex
CREATE INDEX "LauncherPairingClaim_consumedAt_idx" ON "LauncherPairingClaim"("consumedAt");

-- CreateIndex
CREATE INDEX "LauncherChallenge_expiresAt_idx" ON "LauncherChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "LauncherChallenge_consumedAt_idx" ON "LauncherChallenge"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LauncherSession_tokenHash_key" ON "LauncherSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "LauncherSession_tokenId_key" ON "LauncherSession"("tokenId");

-- CreateIndex
CREATE INDEX "LauncherSession_expiresAt_idx" ON "LauncherSession"("expiresAt");

-- CreateIndex
CREATE INDEX "LauncherSession_revokedAt_idx" ON "LauncherSession"("revokedAt");

-- CreateIndex
CREATE INDEX "LauncherSession_installationId_idx" ON "LauncherSession"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "LauncherSessionNonce_sessionId_nonce_key" ON "LauncherSessionNonce"("sessionId", "nonce");

-- CreateIndex
CREATE INDEX "LauncherSessionNonce_expiresAt_idx" ON "LauncherSessionNonce"("expiresAt");

-- AddForeignKey
ALTER TABLE "LauncherSessionNonce" ADD CONSTRAINT "LauncherSessionNonce_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LauncherSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
