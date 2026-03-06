import { FancyPreviewAssemblerService } from './fancy-preview-assembler.service';

describe('FancyPreviewAssemblerService', () => {
  let service: FancyPreviewAssemblerService;

  beforeEach(() => {
    service = new FancyPreviewAssemblerService();
  });

  it('builds simple preview with default play button', () => {
    const preview = service.buildSimplePreview({
      serverName: 'MineRelay Test',
      fancyMenu: {
        enabled: true,
        mode: 'simple',
        playButtonLabel: '',
        hideSingleplayer: true,
        hideMultiplayer: false,
        hideRealms: true,
      },
      branding: {
        backgroundUrl: 'https://example.com/bg.png',
      },
    });

    expect(preview.source).toBe('simple');
    expect(preview.playButtonLabel).toBe('Play');
    expect(
      preview.buttons.find((button) => button.key === 'multiplayer')?.visible,
    ).toBe(true);
    expect(
      preview.buttons.find((button) => button.key === 'singleplayer')?.visible,
    ).toBe(false);
  });

  it('merges custom preview data over baseline', () => {
    const baseline = service.buildSimplePreview({
      serverName: 'MineRelay Test',
      fancyMenu: { enabled: true, mode: 'custom' },
      branding: {},
    });

    const merged = service.mergeCustomPreview(
      baseline,
      {
        token: 'preview-token',
        expiresAt: new Date().toISOString(),
        model: {
          titleText: 'Custom Title',
          subtitleText: 'Custom Subtitle',
          playButtonLabel: 'Join Server',
          backgroundAssetId: 'bg-1',
          logoAssetId: 'logo-1',
          extraButtonLabels: ['Store'],
          notices: ['Custom config parsed'],
        },
        assets: [
          { id: 'bg-1', contentType: 'image/png' },
          { id: 'logo-1', contentType: 'image/png' },
        ],
      },
      '/v1/admin/fancymenu/preview/assets',
    );

    expect(merged.source).toBe('custom');
    expect(merged.titleText).toBe('Custom Title');
    expect(merged.playButtonLabel).toBe('Join Server');
    expect(merged.backgroundUrl).toContain('/preview-token/bg-1');
    expect(merged.logoUrl).toContain('/preview-token/logo-1');
    expect(merged.buttons.some((button) => button.label === 'Store')).toBe(
      true,
    );
  });
});
