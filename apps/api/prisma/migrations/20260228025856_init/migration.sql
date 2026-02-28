-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileVersion" (
    "id" SERIAL NOT NULL,
    "serverId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "minecraftVersion" TEXT NOT NULL,
    "loader" TEXT NOT NULL,
    "loaderVersion" TEXT NOT NULL,
    "lockUrl" TEXT NOT NULL,
    "signature" TEXT,
    "summaryAdd" INTEGER NOT NULL DEFAULT 0,
    "summaryRemove" INTEGER NOT NULL DEFAULT 0,
    "summaryUpdate" INTEGER NOT NULL DEFAULT 0,
    "summaryKeep" INTEGER NOT NULL DEFAULT 0,
    "lockJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileVersion_profileId_version_idx" ON "ProfileVersion"("profileId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileVersion_serverId_version_key" ON "ProfileVersion"("serverId", "version");

-- AddForeignKey
ALTER TABLE "ProfileVersion" ADD CONSTRAINT "ProfileVersion_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
