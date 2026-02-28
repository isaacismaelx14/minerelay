import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ProfileLockSchema } from '@mvl/shared';

const prisma = new PrismaClient();

async function main() {
  const root = resolve(__dirname, '../../../');
  const lockPath = resolve(root, 'infra/sample-data/profile.lock.json');
  const lockRaw = JSON.parse(readFileSync(lockPath, 'utf-8'));
  const lock = ProfileLockSchema.parse(lockRaw);

  const serverId = process.env.SERVER_ID ?? 'mvl';
  const profileId = lock.profileId;
  const lockUrl = process.env.LOCK_URL ?? `http://localhost:3000/v1/locks/${profileId}/${lock.version}`;

  await prisma.server.upsert({
    where: { id: serverId },
    create: {
      id: serverId,
      name: lock.branding.serverName,
      address: lock.defaultServer.address,
      allowedMinecraftVersions: [lock.minecraftVersion],
      fancyMenuEnabled: lock.fancyMenu.enabled,
      fancyMenuSettings: lock.fancyMenu as unknown as object,
      profileId,
    },
    update: {
      name: lock.branding.serverName,
      address: lock.defaultServer.address,
      allowedMinecraftVersions: [lock.minecraftVersion],
      fancyMenuEnabled: lock.fancyMenu.enabled,
      fancyMenuSettings: lock.fancyMenu as unknown as object,
      profileId,
    },
  });

  await prisma.profileVersion.upsert({
    where: {
      serverId_version: {
        serverId,
        version: lock.version,
      },
    },
    create: {
      serverId,
      profileId,
      version: lock.version,
      minecraftVersion: lock.minecraftVersion,
      loader: lock.loader,
      loaderVersion: lock.loaderVersion,
      defaultServerName: lock.defaultServer.name,
      defaultServerAddress: lock.defaultServer.address,
      fancyMenuEnabled: lock.fancyMenu.enabled,
      fancyMenuSettings: lock.fancyMenu as unknown as object,
      lockUrl,
      summaryAdd: lock.items.length + lock.resources.length + lock.shaders.length + lock.configs.length,
      summaryRemove: 0,
      summaryUpdate: 0,
      summaryKeep: 0,
      lockJson: lock,
    },
    update: {
      profileId,
      minecraftVersion: lock.minecraftVersion,
      loader: lock.loader,
      loaderVersion: lock.loaderVersion,
      defaultServerName: lock.defaultServer.name,
      defaultServerAddress: lock.defaultServer.address,
      fancyMenuEnabled: lock.fancyMenu.enabled,
      fancyMenuSettings: lock.fancyMenu as unknown as object,
      lockUrl,
      lockJson: lock,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
