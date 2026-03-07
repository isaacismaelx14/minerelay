import {
  CoreModPolicyService,
  FABRIC_API_PROJECT_ID,
  FANCY_MENU_PROJECT_ID,
  MOD_MENU_PROJECT_ID,
  type ManagedMod,
} from './core-mod-policy.service';

describe('CoreModPolicyService', () => {
  let service: CoreModPolicyService;

  beforeEach(() => {
    service = new CoreModPolicyService();
  });

  const resolver = (
    projectId: string,
    _minecraftVersion: string,
    versionId?: string,
  ): Promise<ManagedMod> =>
    Promise.resolve({
      kind: 'mod',
      name:
        projectId === FABRIC_API_PROJECT_ID
          ? 'Fabric API'
          : projectId === FANCY_MENU_PROJECT_ID
            ? 'FancyMenu'
            : 'Mod Menu',
      provider: 'modrinth',
      side: 'client',
      projectId,
      versionId: versionId || `${projectId}-latest`,
      url: `https://example.com/${projectId}.jar`,
      sha256: 'a'.repeat(64),
    });

  const resolverWithDependencies = (
    projectId: string,
    minecraftVersion: string,
    versionId?: string,
  ): Promise<{ mod: ManagedMod; requiredDependencies: string[] }> => {
    const dependencies: Record<string, string[]> = {
      [FANCY_MENU_PROJECT_ID]: ['dep-a', 'dep-b'],
      [MOD_MENU_PROJECT_ID]: ['dep-m'],
      'dep-a': ['dep-c'],
      'dep-b': [],
      'dep-c': [],
      'dep-m': [],
    };
    return Promise.resolve({
      mod: {
        kind: 'mod',
        name: projectId,
        provider: 'modrinth',
        side: 'client',
        projectId,
        versionId: versionId || `${projectId}-latest`,
        url: `https://example.com/${projectId}.jar`,
        sha256: 'e'.repeat(64),
      },
      requiredDependencies: dependencies[projectId] ?? [],
    });
  };

  it('always injects Fabric API if missing', async () => {
    const mods = await service.normalizeMods({
      mods: [],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: false,
      resolveMod: resolver,
    });
    const fabric = mods.find((mod) => mod.projectId === FABRIC_API_PROJECT_ID);
    expect(fabric).toBeDefined();
    expect(fabric?.side).toBe('both');
  });

  it('removes FancyMenu when feature is disabled', async () => {
    const mods = await service.normalizeMods({
      mods: [
        {
          kind: 'mod',
          name: 'FancyMenu',
          provider: 'modrinth',
          side: 'client',
          projectId: FANCY_MENU_PROJECT_ID,
          versionId: 'fancy-v1',
          url: 'https://example.com/fancy.jar',
          sha256: 'b'.repeat(64),
        },
      ],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: false,
      resolveMod: resolver,
    });
    expect(mods.some((mod) => mod.projectId === FANCY_MENU_PROJECT_ID)).toBe(
      false,
    );
  });

  it('injects FancyMenu when feature is enabled', async () => {
    const mods = await service.normalizeMods({
      mods: [],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: true,
      resolveMod: resolver,
      resolveModWithDependencies: resolverWithDependencies,
    });
    const fancy = mods.find((mod) => mod.projectId === FANCY_MENU_PROJECT_ID);
    expect(fancy).toBeDefined();
    expect(fancy?.side).toBe('client');
  });

  it('injects FancyMenu dependencies and enforces them as client-side', async () => {
    const mods = await service.normalizeMods({
      mods: [],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: true,
      resolveMod: resolver,
      resolveModWithDependencies: resolverWithDependencies,
    });

    const depA = mods.find((mod) => mod.projectId === 'dep-a');
    const depB = mods.find((mod) => mod.projectId === 'dep-b');
    const depC = mods.find((mod) => mod.projectId === 'dep-c');
    expect(depA).toBeDefined();
    expect(depB).toBeDefined();
    expect(depC).toBeDefined();
    expect(depA?.side).toBe('client');
    expect(depB?.side).toBe('client');
    expect(depC?.side).toBe('client');
  });

  it('injects Mod Menu dependencies and enforces them as client-side', async () => {
    const mods = await service.normalizeMods({
      mods: [],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: false,
      resolveMod: resolver,
      resolveModWithDependencies: resolverWithDependencies,
    });

    const depM = mods.find((mod) => mod.projectId === 'dep-m');
    expect(depM).toBeDefined();
    expect(depM?.side).toBe('client');
  });

  it('keeps Fabric API version override when compatible', async () => {
    const mods = await service.normalizeMods({
      mods: [
        {
          kind: 'mod',
          name: 'Fabric API',
          provider: 'modrinth',
          side: 'both',
          projectId: FABRIC_API_PROJECT_ID,
          versionId: 'custom-fabric-version',
          url: 'https://example.com/fabric-custom.jar',
          sha256: 'c'.repeat(64),
        },
      ],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: false,
      resolveMod: resolver,
    });

    const fabric = mods.find((mod) => mod.projectId === FABRIC_API_PROJECT_ID);
    expect(fabric?.versionId).toBe('custom-fabric-version');
    expect(fabric?.side).toBe('both');
  });

  it('marks core mods as locked and non-removable in metadata', () => {
    const metadataEnabled = service.buildMetadata(
      true,
      ['dep-a', 'dep-b', FANCY_MENU_PROJECT_ID],
      ['dep-m', MOD_MENU_PROJECT_ID],
    );
    const metadataDisabled = service.buildMetadata(false);

    expect(
      metadataEnabled.lockedProjectIds.includes(FANCY_MENU_PROJECT_ID),
    ).toBe(true);
    expect(
      metadataEnabled.nonRemovableProjectIds.includes(FANCY_MENU_PROJECT_ID),
    ).toBe(true);
    expect(metadataEnabled.lockedProjectIds.includes('dep-a')).toBe(true);
    expect(metadataEnabled.nonRemovableProjectIds.includes('dep-b')).toBe(true);
    expect(metadataEnabled.lockedProjectIds.includes('dep-m')).toBe(true);
    expect(metadataEnabled.nonRemovableProjectIds.includes('dep-m')).toBe(true);
    expect(metadataEnabled.fancyMenuDependencyProjectIds).toEqual([
      'dep-a',
      'dep-b',
    ]);
    expect(metadataEnabled.modMenuDependencyProjectIds).toEqual(['dep-m']);
    expect(
      metadataDisabled.lockedProjectIds.includes(FANCY_MENU_PROJECT_ID),
    ).toBe(false);
    expect(
      metadataDisabled.nonRemovableProjectIds.includes(FANCY_MENU_PROJECT_ID),
    ).toBe(false);

    const metadata = metadataEnabled;
    expect(metadata.lockedProjectIds.includes(FABRIC_API_PROJECT_ID)).toBe(
      true,
    );
    expect(
      metadata.nonRemovableProjectIds.includes(FABRIC_API_PROJECT_ID),
    ).toBe(true);
    expect(metadata.lockedProjectIds.includes(MOD_MENU_PROJECT_ID)).toBe(true);
    expect(metadata.nonRemovableProjectIds.includes(MOD_MENU_PROJECT_ID)).toBe(
      true,
    );
  });

  it('preserves Fabric API side from incoming mods', async () => {
    const mods = await service.normalizeMods({
      mods: [
        {
          kind: 'mod',
          name: 'Fabric API',
          provider: 'modrinth',
          side: 'server',
          projectId: FABRIC_API_PROJECT_ID,
          versionId: 'fabric-v1',
          url: 'https://example.com/fabric-v1.jar',
          sha256: 'd'.repeat(64),
        },
      ],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: false,
      resolveMod: resolver,
    });

    const fabric = mods.find((mod) => mod.projectId === FABRIC_API_PROJECT_ID);
    expect(fabric?.side).toBe('server');
  });

  it('always injects Mod Menu as client-side', async () => {
    const mods = await service.normalizeMods({
      mods: [],
      minecraftVersion: '1.20.1',
      fancyMenuEnabled: false,
      resolveMod: resolver,
    });
    const modMenu = mods.find((mod) => mod.projectId === MOD_MENU_PROJECT_ID);
    expect(modMenu).toBeDefined();
    expect(modMenu?.side).toBe('client');
  });
});
