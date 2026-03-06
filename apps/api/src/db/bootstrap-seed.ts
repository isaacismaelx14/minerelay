import type { ProfileLock } from '@mss/shared';

const APP_SETTING_ID = 'global';

export const SEED_OVERWRITE_EXISTING_ENV = 'SEED_OVERWRITE_EXISTING';

type SeedTx = {
  server: {
    findUnique(args: { where: { id: string } }): Promise<unknown>;
    upsert(args: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  profileVersion: {
    count(args: { where: { serverId: string } }): Promise<number>;
    upsert(args: {
      where: { serverId_version: { serverId: string; version: number } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  appSetting: {
    findUnique(args: { where: { id: string } }): Promise<unknown>;
    upsert(args: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

export type SeedPrisma = SeedTx & {
  $transaction<T>(fn: (tx: SeedTx) => Promise<T>): Promise<T>;
};

type SeedLogger = Pick<typeof console, 'info'>;

export type SeedResult =
  | { status: 'skipped'; reason: 'existing-bootstrap-state' }
  | { status: 'seeded'; overwriteExisting: boolean };

export function shouldOverwriteExistingSeedData(
  env: NodeJS.ProcessEnv,
): boolean {
  return env[SEED_OVERWRITE_EXISTING_ENV]?.trim().toLowerCase() === 'true';
}

export async function runBootstrapSeed(input: {
  prisma: SeedPrisma;
  serverId: string;
  lock: ProfileLock;
  lockUrl: string;
  overwriteExisting: boolean;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const logger = input.logger ?? console;

  const existingBootstrapState = await hasExistingBootstrapState(
    input.prisma,
    input.serverId,
  );
  if (existingBootstrapState && !input.overwriteExisting) {
    logger.info(
      `[seed] Existing bootstrap data found for server '${input.serverId}'. Skipping seed to preserve runtime-managed values.`,
    );
    return { status: 'skipped', reason: 'existing-bootstrap-state' };
  }

  await input.prisma.$transaction(async (tx) => {
    await tx.server.upsert({
      where: { id: input.serverId },
      create: buildServerSeedCreate({
        serverId: input.serverId,
        lock: input.lock,
      }),
      update: buildServerSeedUpdate(input.lock),
    });

    await tx.profileVersion.upsert({
      where: {
        serverId_version: {
          serverId: input.serverId,
          version: input.lock.version,
        },
      },
      create: buildProfileVersionSeedCreate({
        serverId: input.serverId,
        lock: input.lock,
        lockUrl: input.lockUrl,
      }),
      update: buildProfileVersionSeedUpdate({
        lock: input.lock,
        lockUrl: input.lockUrl,
      }),
    });

    await tx.appSetting.upsert({
      where: { id: APP_SETTING_ID },
      create: buildAppSettingSeedCreate(input.lock),
      update: buildAppSettingSeedUpdate(input.lock),
    });
  });

  logger.info(
    input.overwriteExisting
      ? `[seed] Applied seed with ${SEED_OVERWRITE_EXISTING_ENV}=true for server '${input.serverId}'.`
      : `[seed] Bootstrapped initial seed data for server '${input.serverId}'.`,
  );

  return {
    status: 'seeded',
    overwriteExisting: input.overwriteExisting,
  };
}

async function hasExistingBootstrapState(
  prisma: SeedTx,
  serverId: string,
): Promise<boolean> {
  const [server, profileVersionCount, appSetting] = await Promise.all([
    prisma.server.findUnique({ where: { id: serverId } }),
    prisma.profileVersion.count({ where: { serverId } }),
    prisma.appSetting.findUnique({ where: { id: APP_SETTING_ID } }),
  ]);

  return server !== null || profileVersionCount > 0 || appSetting !== null;
}

function buildServerSeedCreate(input: {
  serverId: string;
  lock: ProfileLock;
}): Record<string, unknown> {
  return {
    id: input.serverId,
    ...buildServerSeedUpdate(input.lock),
  };
}

function buildServerSeedUpdate(lock: ProfileLock): Record<string, unknown> {
  return {
    name: lock.branding.serverName,
    address: lock.defaultServer.address,
    allowedMinecraftVersions: [lock.minecraftVersion],
    fancyMenuEnabled: lock.fancyMenu.enabled,
    fancyMenuSettings: lock.fancyMenu as unknown as object,
    profileId: lock.profileId,
  };
}

function buildProfileVersionSeedCreate(input: {
  serverId: string;
  lock: ProfileLock;
  lockUrl: string;
}): Record<string, unknown> {
  return {
    serverId: input.serverId,
    version: input.lock.version,
    ...buildProfileVersionSeedUpdate({
      lock: input.lock,
      lockUrl: input.lockUrl,
    }),
    summaryAdd:
      input.lock.items.length +
      input.lock.resources.length +
      input.lock.shaders.length +
      input.lock.configs.length,
    summaryRemove: 0,
    summaryUpdate: 0,
    summaryKeep: 0,
  };
}

function buildProfileVersionSeedUpdate(input: {
  lock: ProfileLock;
  lockUrl: string;
}): Record<string, unknown> {
  return {
    profileId: input.lock.profileId,
    releaseVersion: '1.0.0',
    minecraftVersion: input.lock.minecraftVersion,
    loader: input.lock.loader,
    loaderVersion: input.lock.loaderVersion,
    defaultServerName: input.lock.defaultServer.name,
    defaultServerAddress: input.lock.defaultServer.address,
    fancyMenuEnabled: input.lock.fancyMenu.enabled,
    fancyMenuSettings: input.lock.fancyMenu as unknown as object,
    lockUrl: input.lockUrl,
    lockJson: input.lock,
  };
}

function buildAppSettingSeedCreate(lock: ProfileLock): Record<string, unknown> {
  return {
    id: APP_SETTING_ID,
    ...buildAppSettingSeedUpdate(lock),
  };
}

function buildAppSettingSeedUpdate(lock: ProfileLock): Record<string, unknown> {
  return {
    supportedMinecraftVersions: [lock.minecraftVersion],
    supportedPlatforms: ['fabric'],
    releaseMajor: 1,
    releaseMinor: 0,
    releasePatch: 0,
  };
}
