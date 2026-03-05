import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ProfileLockSchema } from '@mss/shared';

const prisma = new PrismaClient();

async function main() {
  const root = resolve(__dirname, '../../../');
  const lockPath = resolve(root, 'infra/sample-data/profile.lock.json');
  const lockRaw: unknown = JSON.parse(readFileSync(lockPath, 'utf-8'));
  const lock = ProfileLockSchema.parse(lockRaw);

  const serverId = process.env.SERVER_ID ?? 'mvl';
  const profileId = lock.profileId;
  const configuredBaseUrl = process.env.API_BASE_URL?.trim();
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const defaultBaseUrl = railwayDomain
    ? `https://${railwayDomain}`
    : 'http://localhost:3000';
  const baseUrl = (
    configuredBaseUrl && configuredBaseUrl.length > 0
      ? configuredBaseUrl
      : defaultBaseUrl
  ).replace(/\/+$/, '');
  const derivedLockUrl = `${baseUrl}/v1/locks/${profileId}/${lock.version}`;
  const lockUrl = process.env.LOCK_URL?.trim() || derivedLockUrl;

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
      releaseVersion: '1.0.0',
      minecraftVersion: lock.minecraftVersion,
      loader: lock.loader,
      loaderVersion: lock.loaderVersion,
      defaultServerName: lock.defaultServer.name,
      defaultServerAddress: lock.defaultServer.address,
      fancyMenuEnabled: lock.fancyMenu.enabled,
      fancyMenuSettings: lock.fancyMenu as unknown as object,
      lockUrl,
      summaryAdd:
        lock.items.length +
        lock.resources.length +
        lock.shaders.length +
        lock.configs.length,
      summaryRemove: 0,
      summaryUpdate: 0,
      summaryKeep: 0,
      lockJson: lock,
    },
    update: {
      profileId,
      releaseVersion: '1.0.0',
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

  await prisma.appSetting.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      supportedMinecraftVersions: [lock.minecraftVersion],
      supportedPlatforms: ['fabric'],
      releaseMajor: 1,
      releaseMinor: 0,
      releasePatch: 0,
    },
    update: {
      supportedMinecraftVersions: [lock.minecraftVersion],
      supportedPlatforms: ['fabric'],
      releaseMajor: 1,
      releaseMinor: 0,
      releasePatch: 0,
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
