import type {
  AdminMod,
  AdminResourcePack,
  AdminShaderPack,
  BootstrapPayload,
  BrandingPayload,
  CoreModPolicy,
  ExarotonServerPayload,
  ExarotonSettingsPayload,
  ExarotonStatusPayload,
  FancyMenuPayload,
} from "@/admin/client/types";

export type StatusTone = "idle" | "ok" | "error";

export type StatusMessage = {
  text: string;
  tone: StatusTone;
};

export type StatusState = {
  bootstrap: StatusMessage;
  draft: StatusMessage;
  settings: StatusMessage;
  mods: StatusMessage;
  publish: StatusMessage;
  fancy: StatusMessage;
  exaroton: StatusMessage;
};

export type ExarotonState = {
  configured: boolean;
  connected: boolean;
  accountName: string;
  accountEmail: string;
  apiKeyInput: string;
  showApiKey: boolean;
  servers: ExarotonServerPayload[];
  selectedServer: ExarotonServerPayload | null;
  settings: ExarotonSettingsPayload;
  busy: boolean;
  error: string;
  connectionStep: "idle" | "key" | "servers" | "success";
};

export type LoaderOption = {
  version: string;
  stable: boolean;
};

export type FormState = {
  searchQuery: string;
  serverName: string;
  serverAddress: string;
  profileId: string;
  currentVersion: number;
  currentReleaseVersion: string;
  minecraftVersion: string;
  loaderVersion: string;
  supportedMinecraftVersions: string;
  brandingLogoUrl: string;
  brandingBackgroundUrl: string;
  brandingNewsUrl: string;
  fancyMenuEnabled: "true" | "false";
  fancyMenuMode: "simple" | "custom";
  playButtonLabel: string;
  hideSingleplayer: "true" | "false";
  hideMultiplayer: "true" | "false";
  hideRealms: "true" | "false";
  fancyMenuCustomLayoutUrl: string;
  fancyMenuCustomLayoutSha256: string;
};

export type PendingInstall = {
  projectId: string;
  title: string;
  dependencies: Array<{ projectId: string; title: string }>;
};

export type RailState = {
  minecraft: string;
  fabric: string;
  nextRelease: string;
};

export type PublishSnapshot = {
  profileId: string;
  serverName: string;
  serverAddress: string;
  minecraftVersion: string;
  loaderVersion: string;
  fancyMenu: FancyMenuPayload;
  branding: BrandingPayload;
  mods: AdminMod[];
  resources: AdminResourcePack[];
  shaders: AdminShaderPack[];
};

export const DEFAULT_STATUS: StatusState = {
  bootstrap: { text: "Loading bootstrap...", tone: "idle" },
  draft: { text: "Ready.", tone: "idle" },
  settings: { text: "Ready.", tone: "idle" },
  mods: { text: "Ready.", tone: "idle" },
  publish: { text: "Ready.", tone: "idle" },
  fancy: { text: "Ready.", tone: "idle" },
  exaroton: { text: "Optional integration is available.", tone: "idle" },
};

export const DEFAULT_EXAROTON: ExarotonState = {
  configured: true,
  connected: false,
  accountName: "",
  accountEmail: "",
  apiKeyInput: "",
  showApiKey: false,
  servers: [],
  selectedServer: null,
  settings: {
    serverStatusEnabled: true,
    modsSyncEnabled: true,
    playerCanViewStatus: true,
    playerCanViewOnlinePlayers: true,
    playerCanStartServer: false,
    playerCanStopServer: false,
    playerCanRestartServer: false,
  },
  busy: false,
  error: "",
  connectionStep: "idle",
};

export const DEFAULT_FORM: FormState = {
  searchQuery: "",
  serverName: "",
  serverAddress: "",
  profileId: "",
  currentVersion: 1,
  currentReleaseVersion: "1.0.0",
  minecraftVersion: "",
  loaderVersion: "",
  supportedMinecraftVersions: "",
  brandingLogoUrl: "",
  brandingBackgroundUrl: "",
  brandingNewsUrl: "",
  fancyMenuEnabled: "true",
  fancyMenuMode: "simple",
  playButtonLabel: "Play",
  hideSingleplayer: "true",
  hideMultiplayer: "true",
  hideRealms: "true",
  fancyMenuCustomLayoutUrl: "",
  fancyMenuCustomLayoutSha256: "",
};

export const DEFAULT_POLICY: CoreModPolicy = {
  fabricApiProjectId: "P7dR8mSH",
  fancyMenuProjectId: "Wq5SjeWM",
  modMenuProjectId: "mOgUt4GM",
  fancyMenuDependencyProjectIds: [],
  modMenuDependencyProjectIds: [],
  lockedProjectIds: ["P7dR8mSH", "mOgUt4GM"],
  nonRemovableProjectIds: ["P7dR8mSH", "mOgUt4GM"],
  rules: {
    fabricApiRequired: true,
    fabricApiVersionEditable: true,
    fancyMenuRequiredWhenEnabled: true,
    modMenuRequired: true,
    fancyMenuEnabled: false,
  },
};

export function mapBootstrapToForm(payload: BootstrapPayload): FormState {
  const draft = payload.draft;
  const draftFancy = draft?.fancyMenu ?? null;
  const latestFancy = payload.latestProfile.fancyMenu ?? null;
  const fancy = draftFancy ?? latestFancy ?? null;
  const draftBranding = draft?.branding ?? null;
  const latestBranding = payload.latestProfile.branding ?? null;
  const branding = draftBranding ?? latestBranding ?? null;

  return {
    searchQuery: "",
    serverName: draft?.serverName ?? payload.server.name ?? "",
    serverAddress: draft?.serverAddress ?? payload.server.address ?? "",
    profileId: draft?.profileId ?? payload.server.profileId ?? "",
    currentVersion: payload.latestProfile.version ?? 1,
    currentReleaseVersion:
      payload.latestProfile.releaseVersion ??
      payload.appSettings.releaseVersion ??
      "1.0.0",
    minecraftVersion:
      draft?.minecraftVersion ?? payload.latestProfile.minecraftVersion ?? "",
    loaderVersion:
      draft?.loaderVersion ?? payload.latestProfile.loaderVersion ?? "",
    supportedMinecraftVersions: (
      payload.appSettings.supportedMinecraftVersions ?? []
    ).join(", "),
    brandingLogoUrl: branding?.logoUrl ?? "",
    brandingBackgroundUrl: branding?.backgroundUrl ?? "",
    brandingNewsUrl: branding?.newsUrl ?? "",
    fancyMenuEnabled: fancy?.enabled === false ? "false" : "true",
    fancyMenuMode: fancy?.mode === "custom" ? "custom" : "simple",
    playButtonLabel: fancy?.playButtonLabel?.trim() || "Play",
    hideSingleplayer: fancy?.hideSingleplayer === false ? "false" : "true",
    hideMultiplayer: fancy?.hideMultiplayer === false ? "false" : "true",
    hideRealms: fancy?.hideRealms === false ? "false" : "true",
    fancyMenuCustomLayoutUrl: fancy?.customLayoutUrl ?? "",
    fancyMenuCustomLayoutSha256: fancy?.customLayoutSha256 ?? "",
  };
}

function normalizeFancyMenuPayload(
  value: Partial<FancyMenuPayload> | undefined,
): FancyMenuPayload {
  return {
    enabled: value?.enabled !== false,
    mode: value?.mode === "custom" ? "custom" : "simple",
    playButtonLabel: value?.playButtonLabel?.trim() || "Play",
    hideSingleplayer: value?.hideSingleplayer !== false,
    hideMultiplayer: value?.hideMultiplayer !== false,
    hideRealms: value?.hideRealms !== false,
    customLayoutUrl: value?.customLayoutUrl?.trim() || undefined,
    customLayoutSha256: value?.customLayoutSha256?.trim() || undefined,
  };
}

export function buildPublishedSnapshotFromBootstrap(
  payload: BootstrapPayload,
): PublishSnapshot {
  return {
    profileId: payload.server.profileId?.trim() || "",
    serverName: payload.server.name?.trim() || "",
    serverAddress: payload.server.address?.trim() || "",
    minecraftVersion: payload.latestProfile.minecraftVersion?.trim() || "",
    loaderVersion: payload.latestProfile.loaderVersion?.trim() || "",
    fancyMenu: normalizeFancyMenuPayload(payload.latestProfile.fancyMenu),
    branding: normalizeBrandingForCompare(payload.latestProfile.branding ?? {}),
    mods: [...(payload.latestProfile.mods ?? [])],
    resources: [...(payload.latestProfile.resources ?? [])],
    shaders: [...(payload.latestProfile.shaders ?? [])],
  };
}

export function mapStatusToExarotonState(
  payload: ExarotonStatusPayload,
  previous?: ExarotonState,
): ExarotonState {
  const nextStep = payload.connected
    ? payload.selectedServer
      ? previous?.connectionStep === "success"
        ? "success"
        : "idle"
      : "servers"
    : previous?.connectionStep === "key"
      ? "key"
      : "idle";

  return {
    configured: payload.configured,
    connected: payload.connected,
    accountName: payload.account?.name ?? "",
    accountEmail: payload.account?.email ?? "",
    apiKeyInput: previous?.apiKeyInput ?? "",
    showApiKey: previous?.showApiKey ?? false,
    servers: previous?.servers ?? [],
    selectedServer: payload.selectedServer,
    settings:
      payload.settings ?? previous?.settings ?? DEFAULT_EXAROTON.settings,
    busy: false,
    error: payload.error ?? "",
    connectionStep: nextStep,
  };
}

export function collectFancyMenuPayload(
  formState: FormState,
): FancyMenuPayload {
  const mode = formState.fancyMenuMode === "custom" ? "custom" : "simple";
  return {
    enabled: formState.fancyMenuEnabled === "true",
    mode,
    playButtonLabel: formState.playButtonLabel.trim() || "Play",
    hideSingleplayer: formState.hideSingleplayer === "true",
    hideMultiplayer: formState.hideMultiplayer === "true",
    hideRealms: formState.hideRealms === "true",
    customLayoutUrl:
      mode === "custom"
        ? formState.fancyMenuCustomLayoutUrl.trim() || undefined
        : undefined,
    customLayoutSha256:
      mode === "custom"
        ? formState.fancyMenuCustomLayoutSha256.trim() || undefined
        : undefined,
  };
}

export function collectBrandingPayload(formState: FormState): BrandingPayload {
  return {
    logoUrl: formState.brandingLogoUrl.trim() || undefined,
    backgroundUrl: formState.brandingBackgroundUrl.trim() || undefined,
    newsUrl: formState.brandingNewsUrl.trim() || undefined,
  };
}

export function normalizeBrandingForCompare(
  payload: BrandingPayload,
): BrandingPayload {
  return {
    logoUrl: payload.logoUrl?.trim() || undefined,
    backgroundUrl: payload.backgroundUrl?.trim() || undefined,
    newsUrl: payload.newsUrl?.trim() || undefined,
  };
}

export function buildPublishSnapshot(
  formState: FormState,
  mods: AdminMod[],
  resources: AdminResourcePack[],
  shaders: AdminShaderPack[],
): PublishSnapshot {
  return {
    profileId: formState.profileId.trim(),
    serverName: formState.serverName.trim(),
    serverAddress: formState.serverAddress.trim(),
    minecraftVersion: formState.minecraftVersion.trim(),
    loaderVersion: formState.loaderVersion.trim(),
    fancyMenu: collectFancyMenuPayload(formState),
    branding: normalizeBrandingForCompare(collectBrandingPayload(formState)),
    mods: [...mods],
    resources: [...resources],
    shaders: [...shaders],
  };
}

export function samePublishSnapshot(
  left: PublishSnapshot | null,
  right: PublishSnapshot,
): boolean {
  if (!left) {
    return false;
  }
  if (
    left.profileId !== right.profileId ||
    left.serverName !== right.serverName ||
    left.serverAddress !== right.serverAddress ||
    left.minecraftVersion !== right.minecraftVersion ||
    left.loaderVersion !== right.loaderVersion
  ) {
    return false;
  }
  if (
    JSON.stringify(left.fancyMenu) !== JSON.stringify(right.fancyMenu) ||
    JSON.stringify(left.branding) !== JSON.stringify(right.branding)
  ) {
    return false;
  }
  if (
    JSON.stringify(left.resources) !== JSON.stringify(right.resources) ||
    JSON.stringify(left.shaders) !== JSON.stringify(right.shaders)
  ) {
    return false;
  }
  return true;
}

export function isValidUrl(value: string): boolean {
  if (!value.trim()) {
    return true;
  }
  try {
    new URL(value.trim());
    return true;
  } catch {
    return false;
  }
}
