export type AdminMod = {
  kind: 'mod';
  name: string;
  provider: 'modrinth' | 'direct';
  side: 'client';
  projectId?: string;
  versionId?: string;
  url: string;
  sha256: string;
  iconUrl?: string;
  slug?: string;
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

export type ExarotonServerPayload = {
  id: string;
  name: string;
  address: string;
  motd: string;
  status: number;
  statusLabel: string;
  players: {
    max: number;
    count: number;
  };
  software: {
    id: string;
    name: string;
    version: string;
  } | null;
  shared: boolean;
};

export type ExarotonStatusPayload = {
  configured: boolean;
  connected: boolean;
  account: {
    name: string | null;
    email: string | null;
  } | null;
  selectedServer: ExarotonServerPayload | null;
  error: string | null;
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
    minecraftVersion?: string | null;
    loaderVersion?: string | null;
    mods?: AdminMod[] | null;
    fancyMenu?: Partial<FancyMenuPayload> | null;
    branding?: BrandingPayload | null;
  } | null;
  hasSavedDraft: boolean;
  exaroton: ExarotonStatusPayload;
};

export type FabricVersionsPayload = {
  minecraftVersion: string;
  loaders: Array<{ version: string; stable: boolean }>;
  latestStable: string | null;
};

export type SearchResult = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  iconUrl?: string;
  categories?: string[];
  latestVersion?: string;
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

export type ConnectExarotonPayload = {
  configured: boolean;
  connected: boolean;
  account: {
    name: string;
    email: string;
    verified: boolean;
    credits: number;
  };
  servers: ExarotonServerPayload[];
  selectedServer: ExarotonServerPayload | null;
};

export type ExarotonServersPayload = {
  servers: ExarotonServerPayload[];
};

export type ExarotonSelectPayload = {
  selectedServer: ExarotonServerPayload;
};

export type ExarotonActionPayload = {
  success: boolean;
  action: 'start' | 'stop' | 'restart';
  selectedServer: ExarotonServerPayload;
};

export type ExarotonStreamStatusPayload = {
  selectedServer: ExarotonServerPayload;
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
