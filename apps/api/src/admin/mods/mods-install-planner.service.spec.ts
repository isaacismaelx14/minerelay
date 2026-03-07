import { ModsInstallPlannerService } from './mods-install-planner.service';

describe('ModsInstallPlannerService', () => {
  function createService() {
    const resolver = {
      resolveCompatibleModWithDependencies: jest.fn(),
      resolveCompatiblePack: jest.fn(),
    };
    const modrinth = {
      fetchProject: jest.fn(),
    };

    const service = new ModsInstallPlannerService(
      resolver as never,
      modrinth as never,
    );

    return { service, resolver, modrinth };
  }

  it('returns only successful dependency analyses in batch mode', async () => {
    const { service, resolver, modrinth } = createService();
    resolver.resolveCompatibleModWithDependencies
      .mockResolvedValueOnce({
        mod: { projectId: 'ok', versionId: 'v1' },
        requiredDependencies: ['dep-ok'],
      })
      .mockRejectedValueOnce(new Error('failed'));
    modrinth.fetchProject.mockResolvedValue({ title: 'Dependency OK' });

    const result = await service.analyzeModDependenciesBatch(
      ['ok', 'bad'],
      '1.20.1',
    );

    expect(Object.keys(result.analysis)).toEqual(['ok']);
    expect(result.analysis.ok).toBeDefined();
    expect(result.analysis.ok!.requiredDependencies).toEqual(['dep-ok']);
  });

  it('routes resourcepack install to pack resolver', async () => {
    const { service, resolver } = createService();
    resolver.resolveCompatiblePack.mockResolvedValue({
      kind: 'resourcepack',
      name: 'Pack',
      provider: 'modrinth',
      projectId: 'pack',
      versionId: 'v1',
      url: 'https://example.com/pack.zip',
      sha256: 'a'.repeat(64),
    });

    const result = await service.installAsset({
      projectId: 'pack',
      minecraftVersion: '1.20.1',
      type: 'resourcepack',
    });

    expect('resources' in result).toBe(true);
    if ('resources' in result) {
      expect(result.resources).toHaveLength(1);
    }
    expect(resolver.resolveCompatiblePack).toHaveBeenCalledWith(
      'pack',
      '1.20.1',
      'resourcepack',
      undefined,
    );
  });
});
