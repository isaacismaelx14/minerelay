import type { ProfileLock } from '@mss/shared';
import {
  runBootstrapSeed,
  SEED_OVERWRITE_EXISTING_ENV,
  shouldOverwriteExistingSeedData,
  type SeedPrisma,
} from './bootstrap-seed';

const lock: ProfileLock = {
  profileId: 'mvl-main',
  version: 2,
  minecraftVersion: '1.21.1',
  loader: 'fabric',
  loaderVersion: '0.16.14',
  defaultServer: {
    name: 'MVL',
    address: 'play.example.com:25565',
  },
  items: [],
  resources: [],
  shaders: [],
  configs: [],
  runtimeHints: {
    javaMajor: 21,
    minMemoryMb: 2048,
    maxMemoryMb: 4096,
  },
  branding: {
    serverName: 'Minecraft Vanilla Launcher',
  },
  fancyMenu: {
    enabled: false,
    mode: 'simple',
    playButtonLabel: 'Play',
    hideSingleplayer: true,
    hideMultiplayer: true,
    hideRealms: true,
  },
};

function createSeedPrisma(): {
  prisma: SeedPrisma;
  spies: {
    transaction: jest.Mock;
    serverFindUnique: jest.MockedFunction<SeedPrisma['server']['findUnique']>;
    serverUpsert: jest.MockedFunction<SeedPrisma['server']['upsert']>;
    profileVersionUpsert: jest.MockedFunction<
      SeedPrisma['profileVersion']['upsert']
    >;
    appSettingUpsert: jest.MockedFunction<SeedPrisma['appSetting']['upsert']>;
  };
} {
  const serverFindUnique: jest.MockedFunction<
    SeedPrisma['server']['findUnique']
  > = jest.fn().mockResolvedValue(null);
  const serverUpsert: jest.MockedFunction<SeedPrisma['server']['upsert']> = jest
    .fn()
    .mockResolvedValue(null);
  const profileVersionCount: jest.MockedFunction<
    SeedPrisma['profileVersion']['count']
  > = jest.fn().mockResolvedValue(0);
  const profileVersionUpsert: jest.MockedFunction<
    SeedPrisma['profileVersion']['upsert']
  > = jest.fn().mockResolvedValue(null);
  const appSettingFindUnique: jest.MockedFunction<
    SeedPrisma['appSetting']['findUnique']
  > = jest.fn().mockResolvedValue(null);
  const appSettingUpsert: jest.MockedFunction<
    SeedPrisma['appSetting']['upsert']
  > = jest.fn().mockResolvedValue(null);

  const tx: Pick<SeedPrisma, 'server' | 'profileVersion' | 'appSetting'> = {
    server: {
      findUnique: serverFindUnique,
      upsert: serverUpsert,
    },
    profileVersion: {
      count: profileVersionCount,
      upsert: profileVersionUpsert,
    },
    appSetting: {
      findUnique: appSettingFindUnique,
      upsert: appSettingUpsert,
    },
  };

  const transaction = jest.fn(
    async (fn: (args: typeof tx) => Promise<unknown>) => fn(tx),
  );
  const prisma: SeedPrisma = {
    ...tx,
    $transaction: transaction as SeedPrisma['$transaction'],
  };

  return {
    prisma,
    spies: {
      transaction,
      serverFindUnique,
      serverUpsert,
      profileVersionUpsert,
      appSettingUpsert,
    },
  };
}

describe('bootstrap seed', () => {
  it('detects the overwrite env flag', () => {
    expect(
      shouldOverwriteExistingSeedData({
        [SEED_OVERWRITE_EXISTING_ENV]: 'true',
      }),
    ).toBe(true);
    expect(
      shouldOverwriteExistingSeedData({
        [SEED_OVERWRITE_EXISTING_ENV]: 'false',
      }),
    ).toBe(false);
    expect(shouldOverwriteExistingSeedData({})).toBe(false);
  });

  it('skips writes when bootstrap state already exists', async () => {
    const loggerInfo = jest.fn();
    const logger = { info: loggerInfo };
    const { prisma, spies } = createSeedPrisma();
    spies.serverFindUnique.mockResolvedValue({ id: 'mvl' });

    const result = await runBootstrapSeed({
      prisma,
      serverId: 'mvl',
      lock,
      lockUrl: 'https://example.com/v1/locks/mvl-main/2',
      overwriteExisting: false,
      logger,
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'existing-bootstrap-state',
    });
    expect(spies.transaction).not.toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledWith(
      "[seed] Existing bootstrap data found for server 'mvl'. Skipping seed to preserve runtime-managed values.",
    );
  });

  it('bootstraps seed data on an empty database', async () => {
    const loggerInfo = jest.fn();
    const logger = { info: loggerInfo };
    const { prisma, spies } = createSeedPrisma();

    const result = await runBootstrapSeed({
      prisma,
      serverId: 'mvl',
      lock,
      lockUrl: 'https://example.com/v1/locks/mvl-main/2',
      overwriteExisting: false,
      logger,
    });

    expect(result).toEqual({
      status: 'seeded',
      overwriteExisting: false,
    });
    expect(spies.transaction).toHaveBeenCalledTimes(1);
    const serverUpsertArgs = spies.serverUpsert.mock.calls[0]?.[0];
    expect(serverUpsertArgs).toBeDefined();
    expect(serverUpsertArgs?.where).toEqual({ id: 'mvl' });
    expect(serverUpsertArgs?.create).toMatchObject({
      id: 'mvl',
      name: 'Minecraft Vanilla Launcher',
      address: 'play.example.com:25565',
      profileId: 'mvl-main',
    });
    expect(spies.profileVersionUpsert).toHaveBeenCalledTimes(1);
    expect(spies.appSettingUpsert).toHaveBeenCalledTimes(1);
    expect(loggerInfo).toHaveBeenCalledWith(
      "[seed] Bootstrapped initial seed data for server 'mvl'.",
    );
  });

  it('overwrites existing data when the force flag is enabled', async () => {
    const loggerInfo = jest.fn();
    const logger = { info: loggerInfo };
    const { prisma, spies } = createSeedPrisma();
    spies.serverFindUnique.mockResolvedValue({ id: 'mvl' });

    const result = await runBootstrapSeed({
      prisma,
      serverId: 'mvl',
      lock,
      lockUrl: 'https://example.com/v1/locks/mvl-main/2',
      overwriteExisting: true,
      logger,
    });

    expect(result).toEqual({
      status: 'seeded',
      overwriteExisting: true,
    });
    expect(spies.transaction).toHaveBeenCalledTimes(1);
    const serverUpsertArgs = spies.serverUpsert.mock.calls[0]?.[0];
    expect(serverUpsertArgs).toBeDefined();
    expect(serverUpsertArgs?.update).toMatchObject({
      name: 'Minecraft Vanilla Launcher',
      address: 'play.example.com:25565',
      profileId: 'mvl-main',
    });
    expect(loggerInfo).toHaveBeenCalledWith(
      "[seed] Applied seed with SEED_OVERWRITE_EXISTING=true for server 'mvl'.",
    );
  });
});
