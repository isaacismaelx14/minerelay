import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import { authFetch, requestJson, uploadForm } from './http';
import type {
  AdminMod,
  BootstrapPayload,
  BrandingPayload,
  ConnectExarotonPayload,
  CoreModPolicy,
  DependencyAnalysis,
  ExarotonActionPayload,
  ExarotonSettingsPayload,
  ExarotonSettingsUpdatePayload,
  ExarotonSelectPayload,
  ExarotonServerPayload,
  ExarotonServersPayload,
  ExarotonSyncModsPayload,
  ExarotonStreamStatusPayload,
  ExarotonStatusPayload,
  FabricVersionsPayload,
  FancyMenuPayload,
  InstallModsPayload,
  ModVersionsPayload,
  PublishProgressPayload,
  PublishPayload,
  PublishStartPayload,
  SaveDraftPayload,
  SaveSettingsPayload,
  SearchResult,
  UploadBundlePayload,
  UploadImagePayload,
} from './types';

type StatusTone = 'idle' | 'ok' | 'error';

type StatusMessage = {
  text: string;
  tone: StatusTone;
};

type StatusState = {
  bootstrap: StatusMessage;
  draft: StatusMessage;
  settings: StatusMessage;
  mods: StatusMessage;
  publish: StatusMessage;
  fancy: StatusMessage;
  exaroton: StatusMessage;
};

type ExarotonState = {
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
  connectionStep: 'idle' | 'key' | 'servers' | 'success';
};

type LoaderOption = {
  version: string;
  stable: boolean;
};

type FormState = {
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
  fancyMenuEnabled: 'true' | 'false';
  fancyMenuMode: 'simple' | 'custom';
  playButtonLabel: string;
  hideSingleplayer: 'true' | 'false';
  hideMultiplayer: 'true' | 'false';
  hideRealms: 'true' | 'false';
  fancyMenuCustomLayoutUrl: string;
  fancyMenuCustomLayoutSha256: string;
};

type PendingInstall = {
  projectId: string;
  title: string;
  dependencies: Array<{ projectId: string; title: string }>;
};

type RailState = {
  minecraft: string;
  fabric: string;
  nextRelease: string;
};

type PublishSnapshot = {
  profileId: string;
  serverName: string;
  serverAddress: string;
  minecraftVersion: string;
  loaderVersion: string;
  fancyMenu: FancyMenuPayload;
  branding: BrandingPayload;
  mods: AdminMod[];
};

type AdminView =
  | 'overview'
  | 'identity'
  | 'mods'
  | 'fancy'
  | 'servers'
  | 'launcher';

type AdminContextValue = {
  view: AdminView;
  setView: (view: AdminView) => void;
  form: FormState;
  setTextFieldFromEvent: (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  selectedMods: AdminMod[];
  coreModPolicy: CoreModPolicy;
  searchResults: SearchResult[];
  dependencyMap: Record<string, DependencyAnalysis>;
  pendingInstall: PendingInstall | null;
  modVersionOptions: Record<string, ModVersionsPayload['versions']>;
  loaderOptions: LoaderOption[];
  statuses: StatusState;
  exaroton: ExarotonState;
  sessionState: 'pending' | 'active';
  hasPendingPublish: boolean;
  hasPendingServerModChanges: boolean;
  publishBlockReason: string | null;
  hasSavedDraft: boolean;
  rail: RailState;
  isBusy: {
    bootstrap: boolean;
    search: boolean;
    publish: boolean;
    install: boolean;
  };
  actions: {
    logout: () => Promise<void>;
    refreshLoaders: () => Promise<void>;
    searchMods: () => Promise<void>;
    setSearchQuery: (query: string) => void;
    analyzeDeps: (projectId: string) => Promise<DependencyAnalysis | null>;
    requestAndConfirmInstall: (projectId: string) => Promise<void>;
    requestInstall: (projectId: string) => Promise<void>;
    confirmInstall: () => Promise<void>;
    cancelInstall: () => void;
    removeMod: (projectId: string, sha256?: string) => void;
    removeModsBulk: (entries: Array<{ projectId?: string; sha256?: string }>) => void;
    setModInstallTarget: (
      projectId: string,
      target: 'client' | 'server' | 'both',
      sha256?: string,
    ) => void;
    setModsInstallTargetBulk: (
      entries: Array<{ projectId?: string; sha256?: string }>,
      target: 'client' | 'server' | 'both',
    ) => void;
    loadModVersions: (projectId: string) => Promise<void>;
    applyModVersion: (projectId: string, versionId: string) => Promise<void>;
    saveSettings: () => Promise<void>;
    saveDraft: () => Promise<void>;
    publishProfile: () => Promise<void>;
    uploadBrandingImage: (
      target: 'logo' | 'background',
      file: File | null,
    ) => Promise<void>;
    uploadFancyBundle: (file: File | null) => Promise<void>;
    setFancyMenuMode: (mode: 'simple' | 'custom') => void;
    setFancyMenuEnabled: (enabled: boolean) => void;
    setExarotonStep: (step: 'idle' | 'key' | 'servers' | 'success') => void;
    setExarotonApiKey: (value: string) => void;
    toggleExarotonApiKeyVisibility: () => void;
    connectExaroton: () => Promise<void>;
    disconnectExaroton: () => Promise<void>;
    refreshExarotonStatus: () => Promise<void>;
    listExarotonServers: () => Promise<void>;
    selectExarotonServer: (serverId: string) => Promise<void>;
    exarotonAction: (action: 'start' | 'stop' | 'restart') => Promise<void>;
    updateExarotonSettings: (payload: {
      modsSyncEnabled?: boolean;
      playerCanViewStatus?: boolean;
      playerCanViewOnlinePlayers?: boolean;
      playerCanStartServer?: boolean;
      playerCanStopServer?: boolean;
      playerCanRestartServer?: boolean;
    }) => Promise<void>;
    syncExarotonMods: () => Promise<void>;
  };
  baselineRuntime: {
    minecraftVersion: string;
    loaderVersion: string;
  };
  summaryStats: {
    add: number;
    remove: number;
    update: number;
    keep: number;
  };
};

const DEFAULT_STATUS: StatusState = {
  bootstrap: { text: 'Loading bootstrap...', tone: 'idle' },
  draft: { text: 'Ready.', tone: 'idle' },
  settings: { text: 'Ready.', tone: 'idle' },
  mods: { text: 'Ready.', tone: 'idle' },
  publish: { text: 'Ready.', tone: 'idle' },
  fancy: { text: 'Ready.', tone: 'idle' },
  exaroton: { text: 'Optional integration is available.', tone: 'idle' },
};

const DEFAULT_EXAROTON: ExarotonState = {
  configured: true,
  connected: false,
  accountName: '',
  accountEmail: '',
  apiKeyInput: '',
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
  error: '',
  connectionStep: 'idle',
};

const DEFAULT_FORM: FormState = {
  searchQuery: '',
  serverName: '',
  serverAddress: '',
  profileId: '',
  currentVersion: 1,
  currentReleaseVersion: '1.0.0',
  minecraftVersion: '',
  loaderVersion: '',
  supportedMinecraftVersions: '',
  brandingLogoUrl: '',
  brandingBackgroundUrl: '',
  brandingNewsUrl: '',
  fancyMenuEnabled: 'true',
  fancyMenuMode: 'simple',
  playButtonLabel: 'Play',
  hideSingleplayer: 'true',
  hideMultiplayer: 'true',
  hideRealms: 'true',
  fancyMenuCustomLayoutUrl: '',
  fancyMenuCustomLayoutSha256: '',
};

const DEFAULT_POLICY: CoreModPolicy = {
  fabricApiProjectId: 'P7dR8mSH',
  fancyMenuProjectId: 'Wq5SjeWM',
  lockedProjectIds: ['P7dR8mSH'],
  nonRemovableProjectIds: ['P7dR8mSH'],
  rules: {
    fabricApiRequired: true,
    fabricApiVersionEditable: true,
    fancyMenuRequiredWhenEnabled: true,
    fancyMenuEnabled: false,
  },
};

const BOOTSTRAP_CACHE_TTL_MS = 15_000;
const FABRIC_VERSIONS_CACHE_TTL_MS = 60_000;
let bootstrapCache: { payload: BootstrapPayload; expiresAt: number } | null =
  null;
let bootstrapInFlight: Promise<BootstrapPayload> | null = null;
const fabricVersionsCache = new Map<
  string,
  { payload: FabricVersionsPayload; expiresAt: number }
>();
const fabricVersionsInFlight = new Map<
  string,
  Promise<FabricVersionsPayload>
>();

async function readBootstrapPayload(force = false): Promise<BootstrapPayload> {
  const now = Date.now();
  if (!force && bootstrapCache && bootstrapCache.expiresAt > now) {
    return bootstrapCache.payload;
  }
  if (bootstrapInFlight) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = requestJson<BootstrapPayload>(
    '/v1/admin/bootstrap',
    'GET',
  )
    .then((payload) => {
      bootstrapCache = {
        payload,
        expiresAt: Date.now() + BOOTSTRAP_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      bootstrapInFlight = null;
    });

  return bootstrapInFlight;
}

async function readFabricVersionsPayload(
  minecraftVersion: string,
  force = false,
): Promise<FabricVersionsPayload> {
  const now = Date.now();
  const cached = fabricVersionsCache.get(minecraftVersion);
  if (!force && cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const inFlight = fabricVersionsInFlight.get(minecraftVersion);
  if (inFlight) {
    return inFlight;
  }

  const request = requestJson<FabricVersionsPayload>(
    `/v1/admin/fabric/versions?minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
    'GET',
  )
    .then((payload) => {
      fabricVersionsCache.set(minecraftVersion, {
        payload,
        expiresAt: Date.now() + FABRIC_VERSIONS_CACHE_TTL_MS,
      });
      return payload;
    })
    .finally(() => {
      fabricVersionsInFlight.delete(minecraftVersion);
    });

  fabricVersionsInFlight.set(minecraftVersion, request);
  return request;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function normalizeSemver(value: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return { major: 1, minor: 0, patch: 0 };
  }

  return {
    major: Number(match[1]) || 1,
    minor: Number(match[2]) || 0,
    patch: Number(match[3]) || 0,
  };
}

function bumpSemver(
  current: { major: number; minor: number; patch: number },
  type: 'major' | 'minor' | 'patch',
): string {
  if (type === 'major') {
    return `${current.major + 1}.0.0`;
  }

  if (type === 'minor') {
    return `${current.major}.${current.minor + 1}.0`;
  }

  return `${current.major}.${current.minor}.${current.patch + 1}`;
}

function modFingerprint(mod: AdminMod): string {
  return [
    mod.projectId ?? '',
    mod.versionId ?? '',
    mod.sha256 ?? '',
    mod.url ?? '',
    mod.side ?? 'client',
  ].join('|');
}

function isServerRelevantMod(mod: AdminMod): boolean {
  return mod.side === 'server' || mod.side === 'both';
}

function computeServerModDiffSummary(current: AdminMod[], baseline: AdminMod[]) {
  const baselineMap = new Map<string, AdminMod>();
  for (const mod of baseline.filter(isServerRelevantMod)) {
    baselineMap.set(mod.projectId || mod.name, mod);
  }

  const currentMap = new Map<string, AdminMod>();
  for (const mod of current.filter(isServerRelevantMod)) {
    currentMap.set(mod.projectId || mod.name, mod);
  }

  let add = 0;
  let remove = 0;
  let update = 0;
  let keep = 0;

  for (const [id, mod] of currentMap) {
    const base = baselineMap.get(id);
    if (!base) {
      add += 1;
    } else if (
      base.versionId !== mod.versionId ||
      base.sha256 !== mod.sha256 ||
      base.url !== mod.url
    ) {
      update += 1;
    } else {
      keep += 1;
    }
  }

  for (const id of baselineMap.keys()) {
    if (!currentMap.has(id)) {
      remove += 1;
    }
  }

  return {
    add,
    remove,
    update,
    keep,
    hasChanges: add + remove + update > 0,
  };
}

function sameMods(left: AdminMod[], right: AdminMod[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = left.map(modFingerprint).slice().sort();
  const normalizedRight = right.map(modFingerprint).slice().sort();

  return normalizedLeft.every(
    (value: string, index: number) => value === normalizedRight[index],
  );
}

function mergeMods(current: AdminMod[], incoming: AdminMod[]): AdminMod[] {
  const map = new Map<string, AdminMod>();
  for (const mod of current) {
    const key = mod.projectId?.trim() || mod.name;
    map.set(key, mod);
  }
  for (const mod of incoming) {
    const key = mod.projectId?.trim() || mod.name;
    map.set(key, mod);
  }
  return Array.from(map.values());
}

function mapBootstrapToForm(payload: BootstrapPayload): FormState {
  const draft = payload.draft;
  const draftFancy = draft?.fancyMenu ?? null;
  const latestFancy = payload.latestProfile.fancyMenu ?? null;
  const fancy = draftFancy ?? latestFancy ?? null;
  const draftBranding = draft?.branding ?? null;
  const latestBranding = payload.latestProfile.branding ?? null;
  const branding = draftBranding ?? latestBranding ?? null;

  return {
    searchQuery: '',
    serverName: draft?.serverName ?? payload.server.name ?? '',
    serverAddress: draft?.serverAddress ?? payload.server.address ?? '',
    profileId: draft?.profileId ?? payload.server.profileId ?? '',
    currentVersion: payload.latestProfile.version ?? 1,
    currentReleaseVersion:
      payload.latestProfile.releaseVersion ??
      payload.appSettings.releaseVersion ??
      '1.0.0',
    minecraftVersion: payload.latestProfile.minecraftVersion ?? '',
    loaderVersion: payload.latestProfile.loaderVersion ?? '',
    supportedMinecraftVersions: (
      payload.appSettings.supportedMinecraftVersions ?? []
    ).join(', '),
    brandingLogoUrl: branding?.logoUrl ?? '',
    brandingBackgroundUrl: branding?.backgroundUrl ?? '',
    brandingNewsUrl: branding?.newsUrl ?? '',
    fancyMenuEnabled: fancy?.enabled === false ? 'false' : 'true',
    fancyMenuMode: fancy?.mode === 'custom' ? 'custom' : 'simple',
    playButtonLabel: fancy?.playButtonLabel?.trim() || 'Play',
    hideSingleplayer: fancy?.hideSingleplayer === false ? 'false' : 'true',
    hideMultiplayer: fancy?.hideMultiplayer === false ? 'false' : 'true',
    hideRealms: fancy?.hideRealms === false ? 'false' : 'true',
    fancyMenuCustomLayoutUrl: fancy?.customLayoutUrl ?? '',
    fancyMenuCustomLayoutSha256: fancy?.customLayoutSha256 ?? '',
  };
}

function mapStatusToExarotonState(
  payload: ExarotonStatusPayload,
  previous?: ExarotonState,
): ExarotonState {
  const nextStep = payload.connected
    ? payload.selectedServer
      ? previous?.connectionStep === 'success'
        ? 'success'
        : 'idle'
      : 'servers'
    : previous?.connectionStep === 'key'
      ? 'key'
      : 'idle';

  return {
    configured: payload.configured,
    connected: payload.connected,
    accountName: payload.account?.name ?? '',
    accountEmail: payload.account?.email ?? '',
    apiKeyInput: previous?.apiKeyInput ?? '',
    showApiKey: previous?.showApiKey ?? false,
    servers: previous?.servers ?? [],
    selectedServer: payload.selectedServer,
    settings: payload.settings ?? previous?.settings ?? DEFAULT_EXAROTON.settings,
    busy: false,
    error: payload.error ?? '',
    connectionStep: nextStep,
  };
}

function normalizeBrandingForCompare(
  payload: BrandingPayload,
): BrandingPayload {
  return {
    logoUrl: payload.logoUrl?.trim() || undefined,
    backgroundUrl: payload.backgroundUrl?.trim() || undefined,
    newsUrl: payload.newsUrl?.trim() || undefined,
  };
}

function buildPublishSnapshot(
  formState: FormState,
  mods: AdminMod[],
  collectFancyMenuPayload: (formState: FormState) => FancyMenuPayload,
  collectBrandingPayload: (formState: FormState) => BrandingPayload,
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
  };
}

function samePublishSnapshot(
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
  return sameMods(left.mods, right.mods);
}

function isValidUrl(val: string): boolean {
  if (!val.trim()) return true;
  try {
    new URL(val.trim());
    return true;
  } catch {
    return false;
  }
}

export function AdminProvider({ children }: PropsWithChildren): ReactElement {
  const [view, setView] = useState<AdminView>('overview');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [selectedMods, setSelectedMods] = useState<AdminMod[]>([]);
  const [coreModPolicy, setCoreModPolicy] =
    useState<CoreModPolicy>(DEFAULT_POLICY);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [dependencyMap, setDependencyMap] = useState<
    Record<string, DependencyAnalysis>
  >({});
  const [pendingInstall, setPendingInstall] = useState<PendingInstall | null>(
    null,
  );
  const [modVersionOptions, setModVersionOptions] = useState<
    Record<string, ModVersionsPayload['versions']>
  >({});
  const [loaderOptions, setLoaderOptions] = useState<LoaderOption[]>([]);
  const [sessionState, setSessionState] = useState<'pending' | 'active'>(
    'pending',
  );
  const [statuses, setStatuses] = useState<StatusState>(DEFAULT_STATUS);
  const [exaroton, setExaroton] = useState<ExarotonState>(DEFAULT_EXAROTON);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [busyBootstrap, setBusyBootstrap] = useState(false);
  const [busySearch, setBusySearch] = useState(false);
  const [busyPublish, setBusyPublish] = useState(false);
  const [busyInstall, setBusyInstall] = useState(false);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const hasBootstrappedRef = useRef(false);
  const latestProfileModsRef = useRef<AdminMod[]>([]);
  const latestProfileRuntimeRef = useRef({
    minecraftVersion: '',
    loaderVersion: '',
  });
  const lastPublishedSnapshotRef = useRef<PublishSnapshot | null>(null);
  const selectedModsRef = useRef<AdminMod[]>([]);
  const lastFancyEnabledRef = useRef<'true' | 'false'>('true');

  useEffect(() => {
    selectedModsRef.current = selectedMods;
  }, [selectedMods]);

  const setStatus = useCallback(
    (name: keyof StatusState, text: string, tone: StatusTone = 'idle') => {
      setStatuses((current) => ({
        ...current,
        [name]: { text, tone },
      }));
    },
    [],
  );

  const isClientRequiredMod = useCallback(
    (projectId: string, mods: AdminMod[]): boolean => {
      if (projectId === coreModPolicy.fabricApiProjectId) {
        return true;
      }
      if (projectId === coreModPolicy.fancyMenuProjectId) {
        return true;
      }

      for (const mod of mods) {
        if (!mod.projectId || mod.side === 'server') {
          continue;
        }
        const analysis = dependencyMap[mod.projectId];
        if (analysis?.requiredDependencies?.includes(projectId)) {
          return true;
        }
      }

      return false;
    },
    [coreModPolicy.fabricApiProjectId, coreModPolicy.fancyMenuProjectId, dependencyMap],
  );

  const normalizeInstallTarget = useCallback(
    (
      projectId: string,
      requestedTarget: 'client' | 'server' | 'both',
      mods: AdminMod[],
    ): { target: 'client' | 'server' | 'both'; reason: string | null } => {
      if (projectId === coreModPolicy.fabricApiProjectId) {
        return { target: requestedTarget, reason: null };
      }

      if (projectId === coreModPolicy.fancyMenuProjectId) {
        return {
          target: 'client',
          reason: 'FancyMenu is user-side only.',
        };
      }

      if (requestedTarget === 'server' && isClientRequiredMod(projectId, mods)) {
        return {
          target: 'both',
          reason: 'This mod is required by a user-side mod, so target was set to User + Server.',
        };
      }

      return { target: requestedTarget, reason: null };
    },
    [
      coreModPolicy.fabricApiProjectId,
      coreModPolicy.fancyMenuProjectId,
      isClientRequiredMod,
    ],
  );

  const refreshExarotonStatus = useCallback(async () => {
    setExaroton((current) => ({ ...current, busy: true }));
    setStatus('exaroton', 'Refreshing Exaroton status...');
    try {
      const payload = await requestJson<ExarotonStatusPayload>(
        '/v1/admin/exaroton/status',
        'GET',
      );
      setExaroton((current) => mapStatusToExarotonState(payload, current));
      setStatus('exaroton', 'Exaroton status updated.', 'ok');
    } catch (error) {
      setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || 'Could not refresh Exaroton status.',
      }));
      setStatus(
        'exaroton',
        (error as Error).message || 'Could not refresh Exaroton status.',
        'error',
      );
    }
  }, [setStatus]);

  const listExarotonServers = useCallback(async () => {
    setExaroton((current) => ({ ...current, busy: true }));
    setStatus('exaroton', 'Loading Exaroton servers...');
    try {
      const payload = await requestJson<ExarotonServersPayload>(
        '/v1/admin/exaroton/servers',
        'GET',
      );
      setExaroton((current) => ({
        ...current,
        busy: false,
        servers: payload.servers ?? [],
      }));
      setStatus('exaroton', 'Server list updated.', 'ok');
    } catch (error) {
      setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || 'Could not load Exaroton servers.',
      }));
      setStatus(
        'exaroton',
        (error as Error).message || 'Could not load Exaroton servers.',
        'error',
      );
    }
  }, [setStatus]);

  const connectExaroton = useCallback(async () => {
    if (exaroton.connected) {
      setStatus(
        'exaroton',
        'An account is already connected. Disconnect it first.',
        'error',
      );
      return;
    }

    const apiKey = exaroton.apiKeyInput.trim();
    if (!apiKey) {
      setStatus('exaroton', 'Enter your Exaroton API key first.', 'error');
      return;
    }

    setExaroton((current) => ({ ...current, busy: true, error: '' }));
    setStatus('exaroton', 'Validating API key with Exaroton...');
    try {
      const payload = await requestJson<ConnectExarotonPayload>(
        '/v1/admin/exaroton/connect',
        'POST',
        { apiKey },
      );

      setExaroton((current) => ({
        ...current,
        configured: payload.configured,
        connected: payload.connected,
        accountName: payload.account?.name ?? '',
        accountEmail: payload.account?.email ?? '',
        apiKeyInput: '',
        showApiKey: false,
        servers: payload.servers ?? [],
        selectedServer: payload.selectedServer ?? null,
        settings: payload.settings ?? current.settings,
        busy: false,
        error: '',
        connectionStep: 'servers',
      }));
      setStatus('exaroton', 'Exaroton account connected.', 'ok');
    } catch (error) {
      setExaroton((current) => ({
        ...current,
        busy: false,
        error:
          (error as Error).message || 'Failed to connect Exaroton account.',
      }));
      setStatus(
        'exaroton',
        (error as Error).message || 'Failed to connect Exaroton account.',
        'error',
      );
    }
  }, [exaroton.connected, exaroton.apiKeyInput, setStatus]);

  const disconnectExaroton = useCallback(async () => {
    setExaroton((current) => ({ ...current, busy: true }));
    setStatus('exaroton', 'Disconnecting Exaroton account...');
    try {
      await requestJson<{ success: boolean }>(
        '/v1/admin/exaroton/disconnect',
        'DELETE',
      );
      setExaroton((current) => ({
        ...current,
        connected: false,
        accountName: '',
        accountEmail: '',
        servers: [],
        selectedServer: null,
        busy: false,
        error: '',
        connectionStep: 'idle',
      }));
      setStatus('exaroton', 'Exaroton account disconnected.', 'ok');
    } catch (error) {
      setExaroton((current) => ({
        ...current,
        busy: false,
        error:
          (error as Error).message || 'Failed to disconnect Exaroton account.',
      }));
      setStatus(
        'exaroton',
        (error as Error).message || 'Failed to disconnect Exaroton account.',
        'error',
      );
    }
  }, [setStatus]);

  const selectExarotonServer = useCallback(
    async (serverId: string) => {
      const cleanServerId = serverId.trim();
      if (!cleanServerId) {
        return;
      }
      setExaroton((current) => ({ ...current, busy: true }));
      setStatus('exaroton', 'Selecting Exaroton server...');
      try {
        const payload = await requestJson<ExarotonSelectPayload>(
          '/v1/admin/exaroton/server/select',
          'POST',
          { serverId: cleanServerId },
        );
        setExaroton((current) => ({
          ...current,
          busy: false,
          selectedServer: payload.selectedServer,
          connectionStep: current.selectedServer ? 'idle' : 'success',
        }));
        setStatus('exaroton', 'Server selected.', 'ok');
      } catch (error) {
        setExaroton((current) => ({
          ...current,
          busy: false,
          error: (error as Error).message || 'Failed to select server.',
        }));
        setStatus(
          'exaroton',
          (error as Error).message || 'Failed to select server.',
          'error',
        );
      }
    },
    [setStatus],
  );

  const exarotonAction = useCallback(
    async (action: 'start' | 'stop' | 'restart') => {
      setExaroton((current) => ({ ...current, busy: true }));
      setStatus('exaroton', `Sending ${action} action...`);
      try {
        const payload = await requestJson<ExarotonActionPayload>(
          '/v1/admin/exaroton/server/action',
          'POST',
          { action },
        );
        setExaroton((current) => ({
          ...current,
          busy: false,
          selectedServer: payload.selectedServer,
        }));
        setStatus('exaroton', `Server ${action} action sent.`, 'ok');
      } catch (error) {
        setExaroton((current) => ({
          ...current,
          busy: false,
          error: (error as Error).message || `Failed to ${action} server.`,
        }));
        setStatus(
          'exaroton',
          (error as Error).message || `Failed to ${action} server.`,
          'error',
        );
      }
    },
    [setStatus],
  );

  useEffect(() => {
    if (!exaroton.connected || !exaroton.selectedServer?.id) {
      return;
    }

    const stream = new EventSource('/v1/admin/exaroton/server/stream');

    const onStatus = (event: Event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(
          message.data,
        ) as ExarotonStreamStatusPayload;
        const next = payload.selectedServer;
        if (!next?.id) {
          return;
        }
        setExaroton((current) => ({
          ...current,
          selectedServer: next,
          servers: current.servers.map((server) =>
            server.id === next.id ? next : server,
          ),
          error: '',
        }));
      } catch {
        // ignore malformed stream payloads
      }
    };

    const onStreamError = (event: Event) => {
      const message = event as MessageEvent<string>;
      let text = 'Exaroton stream error.';
      try {
        const payload = JSON.parse(message.data) as { message?: string };
        if (payload?.message?.trim()) {
          text = payload.message.trim();
        }
      } catch {
        // fallback message
      }
      setExaroton((current) => ({ ...current, error: text }));
      setStatus('exaroton', text, 'error');
    };

    stream.addEventListener('status', onStatus as EventListener);
    stream.addEventListener('stream-error', onStreamError as EventListener);

    return () => {
      stream.removeEventListener('status', onStatus as EventListener);
      stream.removeEventListener(
        'stream-error',
        onStreamError as EventListener,
      );
      stream.close();
    };
  }, [exaroton.connected, exaroton.selectedServer?.id, setStatus]);

  const setTextFieldFromEvent = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const target = event.currentTarget;
      const key = target.name as keyof FormState;
      setForm((current) => ({
        ...current,
        [key]: target.value,
      }));
    },
    [],
  );

  const collectFancyMenuPayload = useCallback(
    (formState: FormState): FancyMenuPayload => {
      const mode = formState.fancyMenuMode === 'custom' ? 'custom' : 'simple';
      return {
        enabled: formState.fancyMenuEnabled === 'true',
        mode,
        playButtonLabel: formState.playButtonLabel.trim() || 'Play',
        hideSingleplayer: formState.hideSingleplayer === 'true',
        hideMultiplayer: formState.hideMultiplayer === 'true',
        hideRealms: formState.hideRealms === 'true',
        customLayoutUrl:
          mode === 'custom'
            ? formState.fancyMenuCustomLayoutUrl.trim() || undefined
            : undefined,
        customLayoutSha256:
          mode === 'custom'
            ? formState.fancyMenuCustomLayoutSha256.trim() || undefined
            : undefined,
      };
    },
    [],
  );

  const collectBrandingPayload = useCallback(
    (formState: FormState): BrandingPayload => ({
      logoUrl: formState.brandingLogoUrl.trim() || undefined,
      backgroundUrl: formState.brandingBackgroundUrl.trim() || undefined,
      newsUrl: formState.brandingNewsUrl.trim() || undefined,
    }),
    [],
  );

  const loadFabricVersions = useCallback(
    async (minecraftVersionInput: string, force = false) => {
      const minecraftVersion = minecraftVersionInput.trim();
      if (!minecraftVersion) {
        setStatus('settings', 'Set Minecraft version first.', 'error');
        return;
      }

      setStatus('settings', 'Loading Fabric versions...');
      try {
        const payload = await readFabricVersionsPayload(
          minecraftVersion,
          force,
        );

        const options = payload.loaders ?? [];
        setLoaderOptions(options);
        setForm((current) => {
          const hasCurrent = options.some(
            (entry) => entry.version === current.loaderVersion,
          );
          if (hasCurrent) {
            return current;
          }

          const nextLoader =
            payload.latestStable ??
            options[0]?.version ??
            current.loaderVersion;
          return {
            ...current,
            loaderVersion: nextLoader,
          };
        });
        setStatus('settings', 'Fabric versions updated.', 'ok');
      } catch (error) {
        setStatus(
          'settings',
          (error as Error).message || 'Failed loading Fabric versions.',
          'error',
        );
      }
    },
    [setStatus],
  );

  const ensureCoreMods = useCallback(
    async (
      mods: AdminMod[],
      fancyEnabled: boolean,
      minecraftVersion: string,
    ) => {
      const cleanVersion = minecraftVersion.trim();
      if (!cleanVersion) {
        return mods;
      }

      let next = [...mods];
      if (!fancyEnabled) {
        next = next.filter(
          (mod) => mod.projectId !== coreModPolicy.fancyMenuProjectId,
        );
      }

      const resolveProject = async (projectId: string): Promise<AdminMod> =>
        requestJson<AdminMod>(
          `/v1/admin/mods/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(cleanVersion)}`,
          'GET',
        );

      const hasFabric = next.some(
        (mod) => mod.projectId === coreModPolicy.fabricApiProjectId,
      );
      if (!hasFabric) {
        try {
          const fabric = await resolveProject(coreModPolicy.fabricApiProjectId);
          next = mergeMods(next, [fabric]);
        } catch {
          setStatus('mods', 'Could not auto-sync Fabric API.', 'error');
        }
      }

      if (fancyEnabled) {
        const hasFancy = next.some(
          (mod) => mod.projectId === coreModPolicy.fancyMenuProjectId,
        );
        if (!hasFancy) {
          try {
            const fancy = await resolveProject(
              coreModPolicy.fancyMenuProjectId,
            );
            next = mergeMods(next, [fancy]);
          } catch {
            setStatus('mods', 'Could not auto-sync FancyMenu mod.', 'error');
          }
        }
      }

      return next;
    },
    [
      coreModPolicy.fabricApiProjectId,
      coreModPolicy.fancyMenuProjectId,
      setStatus,
    ],
  );

  const loadBootstrap = useCallback(async () => {
    setBusyBootstrap(true);
    setStatus('bootstrap', 'Loading bootstrap...');

    try {
      const payload = await readBootstrapPayload();
      const nextForm = mapBootstrapToForm(payload);
      setForm(nextForm);
      setExaroton((current) =>
        mapStatusToExarotonState(payload.exaroton, current),
      );
      setCoreModPolicy(payload.latestProfile.coreModPolicy ?? DEFAULT_POLICY);
      setSelectedMods(payload.latestProfile.mods ?? []);
      latestProfileModsRef.current = payload.latestProfile.mods ?? [];
      latestProfileRuntimeRef.current = {
        minecraftVersion: payload.latestProfile.minecraftVersion ?? '',
        loaderVersion: payload.latestProfile.loaderVersion ?? '',
      };
      lastFancyEnabledRef.current = nextForm.fancyMenuEnabled;
      setSessionState('active');
      setHasSavedDraft(payload.hasSavedDraft ?? payload.draft !== null);
      setStatus('bootstrap', 'Bootstrap loaded.', 'ok');
      await loadFabricVersions(nextForm.minecraftVersion);
      const syncedMods = await ensureCoreMods(
        payload.latestProfile.mods ?? [],
        nextForm.fancyMenuEnabled === 'true',
        nextForm.minecraftVersion,
      );
      setSelectedMods(syncedMods);
      if (payload.exaroton.connected) {
        const serverPayload = await requestJson<ExarotonServersPayload>(
          '/v1/admin/exaroton/servers',
          'GET',
        ).catch(() => null);
        if (serverPayload) {
          setExaroton((current) => ({
            ...current,
            servers: serverPayload.servers ?? [],
          }));
        }
      }
      lastPublishedSnapshotRef.current = buildPublishSnapshot(
        nextForm,
        syncedMods,
        collectFancyMenuPayload,
        collectBrandingPayload,
      );
      setSnapshotTick((current) => current + 1);
    } catch (error) {
      setStatus(
        'bootstrap',
        (error as Error).message || 'Bootstrap failed.',
        'error',
      );
    } finally {
      setBusyBootstrap(false);
    }
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    ensureCoreMods,
    loadFabricVersions,
    listExarotonServers,
    setStatus,
  ]);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (sessionState !== 'active') {
      return;
    }
    if (lastFancyEnabledRef.current === form.fancyMenuEnabled) {
      return;
    }
    lastFancyEnabledRef.current = form.fancyMenuEnabled;
    void (async () => {
      const synced = await ensureCoreMods(
        selectedModsRef.current,
        form.fancyMenuEnabled === 'true',
        form.minecraftVersion,
      );
      setSelectedMods(synced);
    })();
  }, [
    ensureCoreMods,
    form.fancyMenuEnabled,
    form.minecraftVersion,
    sessionState,
  ]);

  const searchMods = useCallback(async () => {
    const query = form.searchQuery?.trim?.() ?? '';
    const minecraftVersion = form.minecraftVersion.trim();

    if (!query) {
      setStatus('mods', 'Type a mod name first.', 'error');
      return;
    }

    if (!minecraftVersion) {
      setStatus('mods', 'Set Minecraft version first.', 'error');
      return;
    }

    setBusySearch(true);
    setStatus('mods', 'Searching mods...');

    try {
      const results = await requestJson<SearchResult[]>(
        `/v1/admin/mods/search?query=${encodeURIComponent(query)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
        'GET',
      );
      const normalizedResults = Array.isArray(results) ? results : [];
      setSearchResults(normalizedResults);

      const dependencyEntries = await Promise.all(
        normalizedResults.map(async (entry) => {
          try {
            const analysis = await requestJson<DependencyAnalysis>(
              `/v1/admin/mods/analyze?projectId=${encodeURIComponent(entry.projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
              'GET',
            );
            return [entry.projectId, analysis] as const;
          } catch {
            return null;
          }
        }),
      );

      const dependencyRecord: Record<string, DependencyAnalysis> = {};
      for (const result of dependencyEntries) {
        if (result) {
          dependencyRecord[result[0]] = result[1];
        }
      }

      setDependencyMap(dependencyRecord);
      setStatus('mods', 'Search complete.', 'ok');
    } catch (error) {
      setStatus('mods', (error as Error).message || 'Search failed.', 'error');
    } finally {
      setBusySearch(false);
    }
  }, [form.minecraftVersion, form.searchQuery, setStatus]);

  const requestInstall = useCallback(
    async (projectId: string) => {
      const fromCache = dependencyMap[projectId];
      if (fromCache) {
        setPendingInstall({
          projectId,
          title:
            searchResults.find((entry) => entry.projectId === projectId)
              ?.title || projectId,
          dependencies: fromCache.dependencyDetails,
        });
        return;
      }

      if (!form.minecraftVersion.trim()) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }

      try {
        const analysis = await requestJson<DependencyAnalysis>(
          `/v1/admin/mods/analyze?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(form.minecraftVersion.trim())}`,
          'GET',
        );
        setDependencyMap((current) => ({
          ...current,
          [projectId]: analysis,
        }));
        setPendingInstall({
          projectId,
          title:
            searchResults.find((entry) => entry.projectId === projectId)
              ?.title || projectId,
          dependencies: analysis.dependencyDetails,
        });
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Could not load dependency details.',
          'error',
        );
      }
    },
    [dependencyMap, form.minecraftVersion, searchResults, setStatus],
  );

  const setSearchQuery = useCallback((query: string) => {
    setForm((current) => ({ ...current, searchQuery: query }));
  }, []);

  const analyzeDeps = useCallback(
    async (projectId: string): Promise<DependencyAnalysis | null> => {
      const fromCache = dependencyMap[projectId];
      if (fromCache) return fromCache;
      if (!form.minecraftVersion.trim()) return null;
      try {
        const analysis = await requestJson<DependencyAnalysis>(
          `/v1/admin/mods/analyze?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(form.minecraftVersion.trim())}`,
          'GET',
        );
        setDependencyMap((current) => ({ ...current, [projectId]: analysis }));
        return analysis;
      } catch {
        return null;
      }
    },
    [dependencyMap, form.minecraftVersion],
  );

  const requestAndConfirmInstall = useCallback(
    async (projectId: string) => {
      const minecraftVersion = form.minecraftVersion.trim();
      if (!minecraftVersion) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }
      setBusyInstall(true);
      try {
        const payload = await requestJson<InstallModsPayload>(
          '/v1/admin/mods/install',
          'POST',
          { projectId, minecraftVersion, includeDependencies: true },
        );
        const incoming = payload.mods ?? [];
        const merged = mergeMods(selectedModsRef.current, incoming);
        const synced = await ensureCoreMods(
          merged,
          form.fancyMenuEnabled === 'true',
          minecraftVersion,
        );
        setSelectedMods(synced);
        setStatus(
          'mods',
          `Installed ${payload.primary?.name || projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
          'ok',
        );
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Install failed.',
          'error',
        );
      } finally {
        setBusyInstall(false);
      }
    },
    [ensureCoreMods, form.fancyMenuEnabled, form.minecraftVersion, setStatus],
  );

  const cancelInstall = useCallback(() => {
    setPendingInstall(null);
  }, []);

  const confirmInstall = useCallback(async () => {
    if (!pendingInstall) {
      return;
    }
    const minecraftVersion = form.minecraftVersion.trim();
    if (!minecraftVersion) {
      setStatus('mods', 'Set Minecraft version first.', 'error');
      return;
    }

    setBusyInstall(true);
    setStatus('mods', 'Installing mod and dependencies...');
    try {
      const payload = await requestJson<InstallModsPayload>(
        '/v1/admin/mods/install',
        'POST',
        {
          projectId: pendingInstall.projectId,
          minecraftVersion,
          includeDependencies: true,
        },
      );
      const incoming = payload.mods ?? [];
      const merged = mergeMods(selectedModsRef.current, incoming);
      const synced = await ensureCoreMods(
        merged,
        form.fancyMenuEnabled === 'true',
        minecraftVersion,
      );
      setSelectedMods(synced);
      setPendingInstall(null);
      setStatus(
        'mods',
        `Installed ${payload.primary?.name || pendingInstall.projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
        'ok',
      );
    } catch (error) {
      setStatus('mods', (error as Error).message || 'Install failed.', 'error');
    } finally {
      setBusyInstall(false);
    }
  }, [
    ensureCoreMods,
    form.fancyMenuEnabled,
    form.minecraftVersion,
    pendingInstall,
    setStatus,
  ]);

  const removeMod = useCallback(
    (projectId: string, sha256?: string) => {
      const nonRemovable = new Set(coreModPolicy.nonRemovableProjectIds);
      if (form.fancyMenuEnabled === 'true') {
        nonRemovable.add(coreModPolicy.fancyMenuProjectId);
      }
      if (projectId && nonRemovable.has(projectId)) {
        setStatus('mods', 'This core mod cannot be removed.', 'error');
        return;
      }
      const nextMods = selectedModsRef.current.filter((entry) => {
        if (projectId && entry.projectId === projectId) return false;
        if (sha256 && entry.sha256 === sha256) return false;
        return true;
      });
      selectedModsRef.current = nextMods;
      setSelectedMods(nextMods);
      setStatus('mods', 'Mod removed.', 'ok');
    },
    [coreModPolicy, form.fancyMenuEnabled, setStatus],
  );

  const setModInstallTarget = useCallback(
    (
      projectId: string,
      target: 'client' | 'server' | 'both',
      sha256?: string,
    ) => {
      const targetKey = projectId ||
        selectedModsRef.current.find((entry) => sha256 && entry.sha256 === sha256)
          ?.projectId ||
        '';
      const normalized = normalizeInstallTarget(
        targetKey,
        target,
        selectedModsRef.current,
      );

      setSelectedMods((current) => {
        const next = current.map((entry) => {
          if (projectId && entry.projectId === projectId) {
            return { ...entry, side: normalized.target };
          }
          if (sha256 && entry.sha256 === sha256) {
            return { ...entry, side: normalized.target };
          }
          return entry;
        });
        selectedModsRef.current = next;
        return next;
      });
      setStatus(
        'mods',
        normalized.reason || 'Mod install target updated.',
        'ok',
      );
    },
    [normalizeInstallTarget, setStatus],
  );

  const setModsInstallTargetBulk = useCallback(
    (
      entries: Array<{ projectId?: string; sha256?: string }>,
      target: 'client' | 'server' | 'both',
    ) => {
      const keys = new Set(
        entries.map((entry) => entry.projectId || entry.sha256).filter(Boolean),
      );
      if (!keys.size) {
        return;
      }

      const current = selectedModsRef.current;
      const touched = current.filter((mod) =>
        keys.has(mod.projectId || mod.sha256),
      );

      const nextById = new Map<string, 'client' | 'server' | 'both'>();
      let autoAdjustedCount = 0;
      for (const mod of touched) {
        const projectId = mod.projectId || '';
        const normalized = normalizeInstallTarget(projectId, target, current);
        if (normalized.target !== target) {
          autoAdjustedCount += 1;
        }
        nextById.set(mod.projectId || mod.sha256, normalized.target);
      }

      setSelectedMods((mods) => {
        const next = mods.map((mod) => {
          const key = mod.projectId || mod.sha256;
          const mapped = nextById.get(key);
          if (!mapped) {
            return mod;
          }
          return { ...mod, side: mapped };
        });
        selectedModsRef.current = next;
        return next;
      });

      if (autoAdjustedCount > 0) {
        setStatus(
          'mods',
          `Bulk target updated. ${String(autoAdjustedCount)} mod(s) were auto-adjusted to safe targets.`,
          'ok',
        );
        return;
      }

      setStatus('mods', 'Bulk install target updated.', 'ok');
    },
    [normalizeInstallTarget, setStatus],
  );

  const removeModsBulk = useCallback(
    (entries: Array<{ projectId?: string; sha256?: string }>) => {
      if (!entries.length) {
        return;
      }

      const keys = new Set(
        entries.map((entry) => entry.projectId || entry.sha256).filter(Boolean),
      );
      const nonRemovable = new Set(coreModPolicy.nonRemovableProjectIds);
      if (form.fancyMenuEnabled === 'true') {
        nonRemovable.add(coreModPolicy.fancyMenuProjectId);
      }

      const next = selectedModsRef.current.filter((entry) => {
        const key = entry.projectId || entry.sha256;
        if (!keys.has(key)) {
          return true;
        }
        if (entry.projectId && nonRemovable.has(entry.projectId)) {
          return true;
        }
        return false;
      });

      const removedCount = selectedModsRef.current.length - next.length;
      selectedModsRef.current = next;
      setSelectedMods(next);
      setStatus(
        'mods',
        removedCount > 0
          ? `Removed ${String(removedCount)} mod(s).`
          : 'No removable mods in selection.',
        removedCount > 0 ? 'ok' : 'error',
      );
    },
    [coreModPolicy, form.fancyMenuEnabled, setStatus],
  );

  const loadModVersions = useCallback(
    async (projectId: string) => {
      const minecraftVersion = form.minecraftVersion.trim();
      if (!minecraftVersion) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }

      try {
        const payload = await requestJson<ModVersionsPayload>(
          `/v1/admin/mods/versions?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
          'GET',
        );
        setModVersionOptions((current) => ({
          ...current,
          [projectId]: payload.versions ?? [],
        }));
        setStatus('mods', `Loaded versions for ${payload.projectTitle}.`, 'ok');
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Failed to load mod versions.',
          'error',
        );
      }
    },
    [form.minecraftVersion, setStatus],
  );

  const applyModVersion = useCallback(
    async (projectId: string, versionId: string) => {
      const minecraftVersion = form.minecraftVersion.trim();
      if (!minecraftVersion) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }
      if (!versionId.trim()) {
        return;
      }

      try {
        const resolved = await requestJson<AdminMod>(
          `/v1/admin/mods/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&versionId=${encodeURIComponent(versionId)}`,
          'GET',
        );
        setSelectedMods((current) =>
          current.map((entry) =>
            entry.projectId === projectId ? resolved : entry,
          ),
        );
        setStatus(
          'mods',
          `Updated ${resolved.name} to selected version.`,
          'ok',
        );
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Failed to apply mod version.',
          'error',
        );
      }
    },
    [form.minecraftVersion, setStatus],
  );

  const saveSettings = useCallback(async () => {
    const versions = form.supportedMinecraftVersions
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const payload = await requestJson<SaveSettingsPayload>(
        '/v1/admin/settings',
        'PATCH',
        {
          supportedMinecraftVersions: versions,
          supportedPlatforms: ['fabric'],
        },
      );
      setForm((current) => ({
        ...current,
        supportedMinecraftVersions: (
          payload.supportedMinecraftVersions ?? []
        ).join(', '),
      }));
      setStatus('settings', 'Settings saved.', 'ok');
    } catch (error) {
      setStatus(
        'settings',
        (error as Error).message || 'Failed to save settings.',
        'error',
      );
    }
  }, [form.supportedMinecraftVersions, setStatus]);

  const validateFormFields = useCallback(() => {
    let validationError = '';
    let targetView: 'overview' | 'identity' | 'mods' | 'fancy' = 'identity';
    let targetElement = '';

    const branding = collectBrandingPayload(form);
    const fancy = collectFancyMenuPayload(form);

    if (!form.serverName.trim()) {
      validationError = 'Server Name is required.';
      targetElement = 'serverName';
    } else if (!form.serverAddress.trim()) {
      validationError = 'Server Address is required.';
      targetElement = 'serverAddress';
    } else if (branding.logoUrl && !isValidUrl(branding.logoUrl)) {
      validationError = 'Invalid Server Logo URL.';
      targetElement = 'brandingLogoUrl';
    } else if (branding.backgroundUrl && !isValidUrl(branding.backgroundUrl)) {
      validationError = 'Invalid Background Wallpaper URL.';
      targetElement = 'brandingBackgroundUrl';
    } else if (branding.newsUrl && !isValidUrl(branding.newsUrl)) {
      validationError = 'Invalid Server News Feed URL.';
      targetElement = 'brandingNewsUrl';
    } else if (fancy.customLayoutUrl && !isValidUrl(fancy.customLayoutUrl)) {
      validationError = 'Invalid Custom Layout URL.';
      targetView = 'fancy';
      targetElement = 'fancyMenuCustomLayoutUrl';
    } else if (
      fancy.customLayoutSha256 &&
      !/^[A-Fa-f0-9]{64}$/.test(fancy.customLayoutSha256)
    ) {
      validationError = 'Invalid SHA256 Hash for Custom Layout.';
      targetView = 'fancy';
      targetElement = 'fancyMenuCustomLayoutSha256';
    }

    if (validationError) {
      setStatus('draft', `Validation failed: ${validationError}`, 'error');
      setStatus('publish', `Validation failed: ${validationError}`, 'error');
      setView(targetView);
      setTimeout(() => {
        const el = document.querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >(`[name="${targetElement}"]`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return false;
    }

    return true;
  }, [collectBrandingPayload, collectFancyMenuPayload, form, setStatus]);

  const saveDraft = useCallback(async () => {
    if (!validateFormFields()) return;
    setStatus('draft', 'Saving draft...');
    try {
      const payload = await requestJson<SaveDraftPayload>(
        '/v1/admin/draft',
        'PATCH',
        {
          profileId: form.profileId.trim() || undefined,
          serverName: form.serverName.trim(),
          serverAddress: form.serverAddress.trim(),
          minecraftVersion: form.minecraftVersion.trim() || undefined,
          loaderVersion: form.loaderVersion.trim() || undefined,
          mods: selectedModsRef.current,
          fancyMenu: collectFancyMenuPayload(form),
          branding: collectBrandingPayload(form),
        },
      );

      setForm((current) => ({
        ...current,
        serverName: payload.server?.name ?? current.serverName,
        serverAddress: payload.server?.address ?? current.serverAddress,
        profileId: payload.server?.profileId ?? current.profileId,
        currentReleaseVersion:
          payload.releaseVersion ?? current.currentReleaseVersion,
      }));
      setHasSavedDraft(true);
      setStatus('draft', 'Draft saved.', 'ok');
    } catch (error) {
      setStatus(
        'draft',
        (error as Error).message || 'Failed to save draft.',
        'error',
      );
    }
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    form,
    setStatus,
    validateFormFields,
  ]);

  const publishProfile = useCallback(async () => {
    if (!validateFormFields()) return;

    const localServerModSummary = computeServerModDiffSummary(
      selectedModsRef.current,
      latestProfileModsRef.current,
    );
    const localPublishBlockReason =
      localServerModSummary.hasChanges &&
      exaroton.connected &&
      exaroton.selectedServer &&
      exaroton.settings.modsSyncEnabled &&
      ![0, 7].includes(exaroton.selectedServer.status)
        ? 'Cannot publish pending server mod changes while Exaroton server is running. Stop the server first.'
        : null;

    if (localPublishBlockReason) {
      setStatus('publish', localPublishBlockReason, 'error');
      return;
    }

    const minecraftVersion = form.minecraftVersion.trim();
    const loaderVersion = form.loaderVersion.trim();
    if (!minecraftVersion || !loaderVersion) {
      setStatus(
        'publish',
        'Select Minecraft and Fabric versions first.',
        'error',
      );
      return;
    }
    if (!selectedMods.length) {
      setStatus(
        'publish',
        'Install at least one mod before publishing.',
        'error',
      );
      return;
    }

    setBusyPublish(true);
    setStatus('publish', 'Publishing next release...');

    try {
      const synced = await ensureCoreMods(
        selectedModsRef.current,
        form.fancyMenuEnabled === 'true',
        minecraftVersion,
      );
      setSelectedMods(synced);

      const payload = {
        profileId: form.profileId.trim(),
        serverName: form.serverName.trim(),
        serverAddress: form.serverAddress.trim(),
        minecraftVersion,
        loaderVersion,
        mods: synced,
        fancyMenu: collectFancyMenuPayload(form),
        branding: collectBrandingPayload(form),
      };

      const started = await requestJson<PublishStartPayload>(
        '/v1/admin/profile/publish/start',
        'POST',
        payload,
      );

      const published = await new Promise<PublishPayload>((resolve, reject) => {
        const stream = new EventSource(
          `/v1/admin/profile/publish/stream?jobId=${encodeURIComponent(started.jobId)}`,
        );

        const cleanup = () => {
          stream.close();
        };

        const onProgress = (event: Event) => {
          try {
            const parsed = JSON.parse(
              (event as MessageEvent<string>).data,
            ) as PublishProgressPayload;
            setStatus('publish', parsed.message, 'idle');
          } catch {
            setStatus('publish', 'Publishing next release...', 'idle');
          }
        };

        const onDone = (event: Event) => {
          cleanup();
          try {
            const parsed = JSON.parse(
              (event as MessageEvent<string>).data,
            ) as PublishPayload;
            resolve(parsed);
          } catch {
            reject(new Error('Publish stream returned an invalid payload'));
          }
        };

        const onError = (event: Event) => {
          cleanup();
          try {
            const parsed = JSON.parse(
              (event as MessageEvent<string>).data,
            ) as { message?: string };
            reject(new Error(parsed.message || 'Publish failed.'));
          } catch {
            reject(new Error('Publish failed.'));
          }
        };

        stream.addEventListener('progress', onProgress as EventListener);
        stream.addEventListener('done', onDone as EventListener);
        stream.addEventListener('error', onError as EventListener);
      });
      setForm((current) => ({
        ...current,
        currentVersion: published.version,
        currentReleaseVersion:
          published.releaseVersion || current.currentReleaseVersion,
      }));
      latestProfileModsRef.current = [...synced];
      latestProfileRuntimeRef.current = { minecraftVersion, loaderVersion };
      const updatedForm: FormState = {
        ...form,
        currentVersion: published.version,
        currentReleaseVersion:
          published.releaseVersion || form.currentReleaseVersion,
      };
      lastPublishedSnapshotRef.current = buildPublishSnapshot(
        updatedForm,
        synced,
        collectFancyMenuPayload,
        collectBrandingPayload,
      );
      setSnapshotTick((current) => current + 1);

      setHasSavedDraft(false);
      if (published.exarotonSync?.attempted && !published.exarotonSync.success) {
        setStatus(
          'publish',
          `${published.releaseVersion || `v${published.version}`} published. Exaroton sync warning: ${published.exarotonSync.message}`,
          'error',
        );
        return;
      }
      setStatus(
        'publish',
        `Published ${published.releaseVersion || `v${published.version}`} (${published.bumpType || 'patch'}, +${published.summary.add} / ~${published.summary.update} / -${published.summary.remove}).`,
        'ok',
      );
    } catch (error) {
      setStatus(
        'publish',
        (error as Error).message || 'Publish failed.',
        'error',
      );
    } finally {
      setBusyPublish(false);
    }
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    ensureCoreMods,
    form,
    selectedModsRef,
    setBusyPublish,
    setStatus,
    exaroton.connected,
    exaroton.selectedServer,
    exaroton.settings.modsSyncEnabled,
    validateFormFields,
  ]);

  const uploadBrandingImage = useCallback(
    async (target: 'logo' | 'background', file: File | null) => {
      if (!file) {
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      setStatus('draft', 'Uploading image...');
      try {
        const payload = await uploadForm<UploadImagePayload>(
          '/v1/admin/media/upload',
          formData,
        );
        const url = payload.url ?? '';
        setForm((current) => ({
          ...current,
          brandingLogoUrl: target === 'logo' ? url : current.brandingLogoUrl,
          brandingBackgroundUrl:
            target === 'background' ? url : current.brandingBackgroundUrl,
        }));
        setStatus('draft', 'Image uploaded.', 'ok');
      } catch (error) {
        setStatus(
          'draft',
          (error as Error).message || 'Upload failed.',
          'error',
        );
      }
    },
    [setStatus],
  );

  const uploadFancyBundle = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      setStatus('fancy', 'Uploading FancyMenu bundle...');

      try {
        const payload = await uploadForm<UploadBundlePayload>(
          '/v1/admin/fancymenu/bundle/upload',
          formData,
        );
        setForm((current) => ({
          ...current,
          fancyMenuMode: 'custom',
          fancyMenuCustomLayoutUrl: payload.url ?? '',
          fancyMenuCustomLayoutSha256: payload.sha256 ?? '',
        }));
        setStatus(
          'fancy',
          `FancyMenu bundle uploaded (${String(payload.entryCount ?? 0)} entries).`,
          'ok',
        );
      } catch (error) {
        setStatus(
          'fancy',
          (error as Error).message || 'Bundle upload failed.',
          'error',
        );
      }
    },
    [setStatus],
  );

  const logout = useCallback(async () => {
    try {
      await authFetch('/v1/admin/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login';
    }
  }, []);

  const updateExarotonSettings = useCallback(
    async (payload: {
      modsSyncEnabled?: boolean;
      playerCanViewStatus?: boolean;
      playerCanViewOnlinePlayers?: boolean;
      playerCanStartServer?: boolean;
      playerCanStopServer?: boolean;
      playerCanRestartServer?: boolean;
    }) => {
      setExaroton((current) => ({ ...current, busy: true }));
      setStatus('exaroton', 'Saving Exaroton settings...');
      try {
        const response = await requestJson<ExarotonSettingsUpdatePayload>(
          '/v1/admin/exaroton/settings',
          'PATCH',
          payload,
        );
        setExaroton((current) => ({
          ...current,
          busy: false,
          settings: response.settings,
        }));
        setStatus('exaroton', 'Exaroton settings saved.', 'ok');
      } catch (error) {
        setExaroton((current) => ({
          ...current,
          busy: false,
          error: (error as Error).message || 'Failed to save Exaroton settings.',
        }));
        setStatus(
          'exaroton',
          (error as Error).message || 'Failed to save Exaroton settings.',
          'error',
        );
      }
    },
    [setStatus],
  );

  const syncExarotonMods = useCallback(async () => {
    setExaroton((current) => ({ ...current, busy: true }));
    setStatus('exaroton', 'Running Exaroton mods sync...');
    try {
      const response = await requestJson<ExarotonSyncModsPayload>(
        '/v1/admin/exaroton/mods/sync',
        'POST',
      );
      setExaroton((current) => ({ ...current, busy: false }));
      setStatus(
        'exaroton',
        response.success
          ? `Exaroton mods synced (+${response.summary.add} / -${response.summary.remove} / =${response.summary.keep}).`
          : response.message,
        response.success ? 'ok' : 'error',
      );
    } catch (error) {
      setExaroton((current) => ({
        ...current,
        busy: false,
        error: (error as Error).message || 'Exaroton mods sync failed.',
      }));
      setStatus(
        'exaroton',
        (error as Error).message || 'Exaroton mods sync failed.',
        'error',
      );
    }
  }, [setStatus]);

  const rail = useMemo<RailState>(() => {
    const baselineMods = latestProfileModsRef.current;
    const baselineRuntime = latestProfileRuntimeRef.current;
    let bumpType: 'major' | 'minor' | 'patch' = 'patch';
    if (
      baselineRuntime.minecraftVersion.trim() !==
        form.minecraftVersion.trim() ||
      baselineRuntime.loaderVersion.trim() !== form.loaderVersion.trim()
    ) {
      bumpType = 'major';
    } else if (!sameMods(selectedMods, baselineMods)) {
      bumpType = 'minor';
    }
    const currentRelease = normalizeSemver(form.currentReleaseVersion);
    const nextRelease = bumpSemver(currentRelease, bumpType);
    return {
      minecraft: `MC: ${form.minecraftVersion.trim() || '-'}`,
      fabric: `Fabric: ${form.loaderVersion.trim() || '-'}`,
      nextRelease: `Next release: ${nextRelease} (${bumpType})`,
    };
  }, [
    form.currentReleaseVersion,
    form.loaderVersion,
    form.minecraftVersion,
    selectedMods,
  ]);

  const effectiveCorePolicy = useMemo<CoreModPolicy>(() => {
    const nonRemovable = new Set(coreModPolicy.nonRemovableProjectIds);
    const locked = new Set(coreModPolicy.lockedProjectIds);
    if (form.fancyMenuEnabled === 'true') {
      nonRemovable.add(coreModPolicy.fancyMenuProjectId);
      locked.add(coreModPolicy.fancyMenuProjectId);
    } else {
      nonRemovable.delete(coreModPolicy.fancyMenuProjectId);
      locked.delete(coreModPolicy.fancyMenuProjectId);
    }

    return {
      ...coreModPolicy,
      lockedProjectIds: Array.from(locked),
      nonRemovableProjectIds: Array.from(nonRemovable),
      rules: {
        ...coreModPolicy.rules,
        fancyMenuEnabled: form.fancyMenuEnabled === 'true',
      },
    };
  }, [coreModPolicy, form.fancyMenuEnabled]);

  const serverModSummary = useMemo(() => {
    return computeServerModDiffSummary(
      selectedMods,
      latestProfileModsRef.current,
    );
  }, [selectedMods]);

  const hasPendingServerModChanges = serverModSummary.hasChanges;

  const publishBlockReason = useMemo<string | null>(() => {
    if (!hasPendingServerModChanges) {
      return null;
    }
    if (!exaroton.connected || !exaroton.selectedServer) {
      return null;
    }
    if (!exaroton.settings.modsSyncEnabled) {
      return null;
    }

    const status = exaroton.selectedServer.status;
    const isRunning = ![0, 7].includes(status);
    if (!isRunning) {
      return null;
    }

    return 'Cannot publish pending server mod changes while Exaroton server is running. Stop the server first.';
  }, [
    exaroton.connected,
    exaroton.selectedServer,
    exaroton.settings.modsSyncEnabled,
    hasPendingServerModChanges,
  ]);

  const hasPendingPublish = useMemo<boolean>(() => {
    if (sessionState !== 'active') {
      return false;
    }
    const current = buildPublishSnapshot(
      form,
      selectedMods,
      collectFancyMenuPayload,
      collectBrandingPayload,
    );
    return !samePublishSnapshot(lastPublishedSnapshotRef.current, current);
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    form,
    snapshotTick,
    selectedMods,
    sessionState,
  ]);

  const summaryStats = useMemo(() => {
    const baseline = latestProfileModsRef.current;
    const current = selectedMods;

    const baselineMap = new Map<string, AdminMod>();
    for (const mod of baseline) {
      baselineMap.set(mod.projectId || mod.name, mod);
    }

    const currentMap = new Map<string, AdminMod>();
    for (const mod of current) {
      currentMap.set(mod.projectId || mod.name, mod);
    }

    let add = 0;
    let remove = 0;
    let update = 0;
    let keep = 0;

    for (const [id, mod] of currentMap) {
      const base = baselineMap.get(id);
      if (!base) {
        add++;
      } else if (
        base.versionId !== mod.versionId ||
        base.sha256 !== mod.sha256
      ) {
        update++;
      } else {
        keep++;
      }
    }

    for (const id of baselineMap.keys()) {
      if (!currentMap.has(id)) {
        remove++;
      }
    }

    return { add, remove, update, keep };
  }, [selectedMods]);

  const value = useMemo<AdminContextValue>(
    () => ({
      view,
      setView,
      form,
      setTextFieldFromEvent,
      selectedMods,
      coreModPolicy: effectiveCorePolicy,
      searchResults,
      dependencyMap,
      pendingInstall,
      modVersionOptions,
      loaderOptions,
      statuses,
      exaroton,
      sessionState,
      hasPendingPublish,
      hasPendingServerModChanges,
      publishBlockReason,
      hasSavedDraft,
      rail,
      summaryStats,
      isBusy: {
        bootstrap: busyBootstrap,
        search: busySearch,
        publish: busyPublish,
        install: busyInstall,
      },
      baselineRuntime: latestProfileRuntimeRef.current,
      actions: {
        logout,
        refreshLoaders: () => loadFabricVersions(form.minecraftVersion, true),
        searchMods,
        setSearchQuery,
        analyzeDeps,
        requestAndConfirmInstall,
        requestInstall,
        confirmInstall,
        cancelInstall,
        removeMod,
        removeModsBulk,
        setModInstallTarget,
        setModsInstallTargetBulk,
        loadModVersions,
        applyModVersion,
        saveSettings,
        saveDraft,
        publishProfile,
        uploadBrandingImage,
        uploadFancyBundle,
        setFancyMenuMode: (mode: 'simple' | 'custom') =>
          setForm((prev) => ({ ...prev, fancyMenuMode: mode })),
        setFancyMenuEnabled: (enabled: boolean) =>
          setForm((prev) => ({
            ...prev,
            fancyMenuEnabled: enabled ? 'true' : 'false',
          })),
        setExarotonStep: (step: 'idle' | 'key' | 'servers' | 'success') =>
          setExaroton((prev) => ({ ...prev, connectionStep: step })),
        setExarotonApiKey: (value: string) =>
          setExaroton((prev) => ({ ...prev, apiKeyInput: value })),
        toggleExarotonApiKeyVisibility: () =>
          setExaroton((prev) => ({
            ...prev,
            showApiKey: !prev.showApiKey,
          })),
        connectExaroton,
        disconnectExaroton,
        refreshExarotonStatus,
        listExarotonServers,
        selectExarotonServer,
        exarotonAction,
        updateExarotonSettings,
        syncExarotonMods,
      },
    }),
    [
      busyBootstrap,
      busyInstall,
      busyPublish,
      busySearch,
      confirmInstall,
      coreModPolicy,
      connectExaroton,
      disconnectExaroton,
      effectiveCorePolicy,
      dependencyMap,
      exaroton,
      exarotonAction,
      form,
      hasPendingPublish,
      hasPendingServerModChanges,
      hasSavedDraft,
      listExarotonServers,
      loadFabricVersions,
      loadModVersions,
      loaderOptions,
      logout,
      modVersionOptions,
      pendingInstall,
      publishProfile,
      publishBlockReason,
      rail,
      removeMod,
      removeModsBulk,
      setModInstallTarget,
      setModsInstallTargetBulk,
      requestInstall,
      saveDraft,
      saveSettings,
      searchMods,
      selectedMods,
      selectExarotonServer,
      sessionState,
      setTextFieldFromEvent,
      statuses,
      syncExarotonMods,
      refreshExarotonStatus,
      uploadBrandingImage,
      uploadFancyBundle,
      updateExarotonSettings,
      view,
      summaryStats,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdminContext(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used inside AdminProvider');
  }
  return context;
}
