import { Injectable } from '@nestjs/common';
import type { FancyMenuDto } from './admin.dto';
import type { SandboxPreviewResponse } from './bundle-sandbox.client';

export type FancyPreviewButton = {
  key: 'singleplayer' | 'multiplayer' | 'realms' | 'play' | 'custom';
  label: string;
  visible: boolean;
  primary?: boolean;
};

export type FancyPreviewModel = {
  source: 'simple' | 'custom';
  mode: 'simple' | 'custom';
  serverName: string;
  titleText: string;
  subtitleText: string;
  playButtonLabel: string;
  buttons: FancyPreviewButton[];
  backgroundUrl?: string;
  logoUrl?: string;
  notices: string[];
  assetToken?: string;
};

type BuildSimpleInput = {
  serverName?: string;
  fancyMenu?: FancyMenuDto;
  branding?: {
    logoUrl?: string;
    backgroundUrl?: string;
  };
};

@Injectable()
export class FancyPreviewAssemblerService {
  private normalizeFancyMenu(input?: FancyMenuDto) {
    const enabled = input?.enabled ?? true;
    const mode =
      input?.mode === 'custom' ? ('custom' as const) : ('simple' as const);
    return {
      enabled,
      mode,
      playButtonLabel: input?.playButtonLabel?.trim() || 'Play',
      hideSingleplayer: input?.hideSingleplayer ?? true,
      hideMultiplayer: input?.hideMultiplayer ?? true,
      hideRealms: input?.hideRealms ?? true,
    };
  }

  buildSimplePreview(input: BuildSimpleInput): FancyPreviewModel {
    const serverName = input.serverName?.trim() || 'Minecraft Server';
    const fancy = this.normalizeFancyMenu(input.fancyMenu);
    const enabled = fancy.enabled;
    const buttons: FancyPreviewButton[] = [
      {
        key: 'play',
        label: fancy.playButtonLabel,
        visible: true,
        primary: true,
      },
      {
        key: 'singleplayer',
        label: 'Singleplayer',
        visible: enabled ? !fancy.hideSingleplayer : true,
      },
      {
        key: 'multiplayer',
        label: 'Multiplayer',
        visible: enabled ? !fancy.hideMultiplayer : true,
      },
      {
        key: 'realms',
        label: 'Realms',
        visible: enabled ? !fancy.hideRealms : true,
      },
    ];

    return {
      source: 'simple',
      mode: fancy.mode,
      serverName,
      titleText: serverName,
      subtitleText: enabled
        ? 'Custom launcher menu preview'
        : 'Default Minecraft menu preview',
      playButtonLabel: fancy.playButtonLabel,
      buttons,
      backgroundUrl: input.branding?.backgroundUrl?.trim() || undefined,
      logoUrl: input.branding?.logoUrl?.trim() || undefined,
      notices: enabled
        ? []
        : ['FancyMenu is disabled. Rendering baseline Minecraft menu preview.'],
    };
  }

  mergeCustomPreview(
    baseline: FancyPreviewModel,
    sandbox: SandboxPreviewResponse,
    assetBasePath: string,
  ): FancyPreviewModel {
    const model = sandbox.model;
    const notices = [...baseline.notices];
    for (const notice of model.notices ?? []) {
      if (notice.trim()) {
        notices.push(notice.trim());
      }
    }

    const backgroundUrl = model.backgroundAssetId
      ? `${assetBasePath}/${encodeURIComponent(sandbox.token)}/${encodeURIComponent(model.backgroundAssetId)}`
      : baseline.backgroundUrl;
    const logoUrl = model.logoAssetId
      ? `${assetBasePath}/${encodeURIComponent(sandbox.token)}/${encodeURIComponent(model.logoAssetId)}`
      : baseline.logoUrl;

    const extraButtons: FancyPreviewButton[] = (model.extraButtonLabels ?? [])
      .filter((label) => label.trim().length > 0)
      .map((label) => ({
        key: 'custom',
        label: label.trim(),
        visible: true,
      }));

    return {
      ...baseline,
      source: 'custom',
      mode: 'custom',
      titleText: model.titleText?.trim() || baseline.titleText,
      subtitleText: model.subtitleText?.trim() || baseline.subtitleText,
      playButtonLabel:
        model.playButtonLabel?.trim() || baseline.playButtonLabel,
      backgroundUrl,
      logoUrl,
      buttons: [...baseline.buttons, ...extraButtons],
      notices,
      assetToken: sandbox.token,
    };
  }
}
