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
  requiresDependencies: boolean;
  requiredDependencies: string[];
};

export type InstallModsPayload = {
  mods: AdminMod[];
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
