export type AdminMod = {
  kind: 'mod';
  name: string;
  provider: 'modrinth' | 'direct';
  side: 'client';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
};

export type CoreModPolicy = {
  fabricApiProjectId: string;
  fancyMenuProjectId: string;
  lockedProjectIds: string[];
  nonRemovableProjectIds: string[];
  rules: {
    fabricApiRequired: true;
    fabricApiVersionEditable: true;
    fancyMenuRequiredWhenEnabled: true;
    fancyMenuEnabled: boolean;
  };
};

export type FancyMenuPayload = {
  enabled: boolean;
  mode: 'simple' | 'custom';
  playButtonLabel: string;
  hideSingleplayer: boolean;
  hideMultiplayer: boolean;
  hideRealms: boolean;
  customLayoutUrl?: string;
  customLayoutSha256?: string;
};

export type BrandingPayload = {
  logoUrl?: string;
  backgroundUrl?: string;
  newsUrl?: string;
};

export type BootstrapPayload = {
  server: {
    id: string;
    name: string;
    address: string;
    profileId: string;
  };
  latestProfile: {
    version: number;
    releaseVersion: string;
    minecraftVersion: string;
    loader: string;
    loaderVersion: string;
    mods: AdminMod[];
    coreModPolicy: CoreModPolicy;
    fancyMenu?: Partial<FancyMenuPayload>;
    branding?: BrandingPayload;
  };
  appSettings: {
    supportedMinecraftVersions: string[];
    supportedPlatforms: string[];
    releaseVersion?: string;
  };
  draft: {
    serverName?: string | null;
    serverAddress?: string | null;
    profileId?: string | null;
    fancyMenu?: Partial<FancyMenuPayload> | null;
    branding?: BrandingPayload | null;
  } | null;
};

export type FabricVersionsPayload = {
  minecraftVersion: string;
  loaders: Array<{ version: string; stable: boolean }>;
  latestStable: string | null;
};

export type SearchResult = {
  projectId: string;
  title: string;
  description: string;
};

export type DependencyAnalysis = {
  projectId: string;
  versionId: string;
  requiresDependencies: boolean;
  requiredDependencies: string[];
  dependencyDetails: Array<{ projectId: string; title: string }>;
};

export type InstallModsPayload = {
  primary: AdminMod;
  dependencies: AdminMod[];
  mods: AdminMod[];
};

export type ModVersionsPayload = {
  projectId: string;
  projectTitle: string;
  minecraftVersion: string;
  versions: Array<{
    id: string;
    name: string;
    versionType: 'release' | 'beta' | 'alpha';
    publishedAt: string;
  }>;
};

export type SaveSettingsPayload = {
  supportedMinecraftVersions: string[];
  supportedPlatforms: string[];
  releaseVersion: string;
};

export type SaveDraftPayload = {
  server: {
    id: string;
    name: string;
    address: string;
    profileId: string;
  };
  releaseVersion: string;
  draft: BootstrapPayload['draft'];
};

export type PublishPayload = {
  version: number;
  releaseVersion: string;
  bumpType: 'major' | 'minor' | 'patch';
  summary: {
    add: number;
    remove: number;
    update: number;
    keep: number;
  };
};

export type UploadImagePayload = {
  url: string;
};

export type UploadBundlePayload = {
  url: string;
  sha256: string;
  entryCount: number;
};

export type FancyMenuPreviewAssetRef = {
  token: string;
  id: string;
  contentType: string;
};

export type FancyMenuPreviewModel = {
  source: 'simple' | 'custom';
  mode: 'simple' | 'custom';
  serverName: string;
  titleText: string;
  subtitleText: string;
  playButtonLabel: string;
  buttons: Array<{
    key: 'singleplayer' | 'multiplayer' | 'realms' | 'play' | 'custom';
    label: string;
    visible: boolean;
    primary?: boolean;
  }>;
  backgroundUrl?: string;
  logoUrl?: string;
  notices: string[];
  assetToken?: string;
};

export type FancyMenuPreviewRequest = {
  serverName?: string;
  fancyMenu?: Partial<FancyMenuPayload>;
  branding?: BrandingPayload;
};

export type FancyMenuPreviewPayload = {
  model: FancyMenuPreviewModel;
  expiresAt?: string;
};
