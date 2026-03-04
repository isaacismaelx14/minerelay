import {
  CoreModPolicyService,
  FABRIC_API_PROJECT_ID,
  FANCY_MENU_PROJECT_ID,
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
      name: projectId === FABRIC_API_PROJECT_ID ? 'Fabric API' : 'FancyMenu',
      provider: 'modrinth',
      side: 'client',
      projectId,
      versionId: versionId || `${projectId}-latest`,
      url: `https://example.com/${projectId}.jar`,
      sha256: 'a'.repeat(64),
    });

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
    });
    const fancy = mods.find((mod) => mod.projectId === FANCY_MENU_PROJECT_ID);
    expect(fancy).toBeDefined();
    expect(fancy?.side).toBe('both');
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

  it('marks Fabric API as core and non-removable in metadata', () => {
    const metadata = service.buildMetadata(true);
    expect(metadata.lockedProjectIds.includes(FABRIC_API_PROJECT_ID)).toBe(
      true,
    );
    expect(
      metadata.nonRemovableProjectIds.includes(FABRIC_API_PROJECT_ID),
    ).toBe(true);
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
});
